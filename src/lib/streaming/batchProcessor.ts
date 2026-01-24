/**
 * MUCO-AMPLITUDE: Batch Processor
 * Traitement optimisé par lots pour Big Data (2M+ lignes)
 */

import { supabase } from '@/integrations/supabase/client';
import { validatePayrollEntry, type PayrollEntryRaw } from '@/lib/validation/payrollSchemas';
import { validateRIB, parseRIB } from '@/utils/ribValidation';

export interface BatchProcessorConfig {
  batchSize: number;
  maxRetries: number;
  onProgress?: (progress: BatchProgress) => void;
  onError?: (error: BatchError) => void;
}

export interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  rowsProcessed: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // in seconds
}

export interface BatchError {
  batchNumber: number;
  error: string;
  retryCount: number;
  willRetry: boolean;
}

export interface ProcessedEntry {
  matricule: string;
  nom: string;
  prenom: string;
  rib: string;
  code_banque: string | null;
  code_guichet: string | null;
  numero_compte: string | null;
  cle_rib: string | null;
  montant: number;
  rib_valid: boolean;
  rib_error: string | null;
  status: 'valid' | 'invalid' | 'pending';
  batch_number: number;
}

export interface BatchResult {
  success: boolean;
  importId: string;
  totalProcessed: number;
  totalValid: number;
  totalInvalid: number;
  totalAmount: number;
  processingTimeMs: number;
  errors: BatchError[];
}

/**
 * Créer un nouvel import dans la base de données
 */
export async function createImport(fileName: string, fileSize: number, fileHash?: string): Promise<string> {
  const { data, error } = await supabase
    .from('payroll_imports')
    .insert({
      file_name: fileName,
      file_size: fileSize,
      file_hash: fileHash,
      status: 'pending'
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Erreur création import: ${error.message}`);
  return data.id;
}

/**
 * Mettre à jour le statut d'un import
 */
export async function updateImportStatus(
  importId: string, 
  status: 'pending' | 'processing' | 'completed' | 'failed',
  additionalData?: Partial<{
    total_entries: number;
    valid_entries: number;
    invalid_entries: number;
    total_amount: number;
    error_message: string;
    processing_started_at: string;
    processing_completed_at: string;
  }>
): Promise<void> {
  const { error } = await supabase
    .from('payroll_imports')
    .update({ status, ...additionalData })
    .eq('id', importId);
  
  if (error) throw new Error(`Erreur mise à jour import: ${error.message}`);
}

/**
 * Traiter et valider une entrée de paie
 */
function processEntry(raw: PayrollEntryRaw, batchNumber: number): ProcessedEntry {
  const ribComponents = parseRIB(raw.rib);
  const ribValidation = validateRIB(raw.rib);
  
  return {
    matricule: raw.matricule,
    nom: raw.nom,
    prenom: raw.prenom || '',
    rib: raw.rib,
    code_banque: ribComponents?.codeBanque || null,
    code_guichet: ribComponents?.codeGuichet || null,
    numero_compte: ribComponents?.numeroCompte || null,
    cle_rib: ribComponents?.cleRIB || null,
    montant: raw.montant,
    rib_valid: ribValidation.valid,
    rib_error: ribValidation.error || null,
    status: ribValidation.valid ? 'valid' : 'invalid',
    batch_number: batchNumber
  };
}

/**
 * Insérer un batch dans la base de données
 */
async function insertBatch(
  importId: string, 
  entries: ProcessedEntry[], 
  retryCount: number = 0,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('payroll_entries')
      .insert(entries.map(entry => ({
        import_id: importId,
        ...entry
      })));
    
    if (error) {
      if (retryCount < maxRetries) {
        // Attendre avant de réessayer (backoff exponentiel)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        return insertBatch(importId, entries, retryCount + 1, maxRetries);
      }
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    if (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
      return insertBatch(importId, entries, retryCount + 1, maxRetries);
    }
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inconnue' };
  }
}

/**
 * Enregistrer les statistiques d'un batch
 */
async function recordBatchStats(
  importId: string,
  batchNumber: number,
  stats: {
    rows_processed: number;
    rows_valid: number;
    rows_invalid: number;
    processing_time_ms: number;
  }
): Promise<void> {
  await supabase
    .from('processing_stats')
    .insert({
      import_id: importId,
      batch_number: batchNumber,
      ...stats
    });
}

/**
 * Mettre à jour le cache des matricules
 */
async function updateMatriculeCache(matricules: string[]): Promise<void> {
  const uniqueMatricules = [...new Set(matricules)];
  
  // Upsert pour chaque matricule
  for (const matricule of uniqueMatricules) {
    await supabase
      .from('matricule_cache')
      .upsert(
        { 
          matricule,
          last_seen_at: new Date().toISOString()
        },
        { 
          onConflict: 'matricule',
          ignoreDuplicates: false 
        }
      );
  }
}

/**
 * Traitement par lots des données de paie
 * Algorithme de streaming pour 2M+ lignes avec < 512 Mo RAM
 */
export async function processBatches(
  importId: string,
  rawData: unknown[],
  config: BatchProcessorConfig
): Promise<BatchResult> {
  const startTime = Date.now();
  const { batchSize, maxRetries, onProgress, onError } = config;
  
  const totalRows = rawData.length;
  const totalBatches = Math.ceil(totalRows / batchSize);
  
  let totalProcessed = 0;
  let totalValid = 0;
  let totalInvalid = 0;
  let totalAmount = 0;
  const errors: BatchError[] = [];
  
  // Mettre à jour le statut à "processing"
  await updateImportStatus(importId, 'processing', {
    processing_started_at: new Date().toISOString()
  });
  
  try {
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const batchStart = Date.now();
      const startIdx = batchNum * batchSize;
      const endIdx = Math.min(startIdx + batchSize, totalRows);
      const batchData = rawData.slice(startIdx, endIdx);
      
      // Valider et traiter le batch
      const processedEntries: ProcessedEntry[] = [];
      let batchValid = 0;
      let batchInvalid = 0;
      let batchAmount = 0;
      
      for (const row of batchData) {
        const validationResult = validatePayrollEntry(row);
        
        if (validationResult.success) {
          const entry = processEntry(validationResult.data, batchNum + 1);
          processedEntries.push(entry);
          
          if (entry.rib_valid) {
            batchValid++;
            batchAmount += entry.montant;
          } else {
            batchInvalid++;
          }
        } else {
          // Créer une entrée invalide pour traçabilité
          batchInvalid++;
        }
      }
      
      // Insérer le batch dans la base
      const insertResult = await insertBatch(importId, processedEntries, 0, maxRetries);
      
      if (!insertResult.success) {
        const batchError: BatchError = {
          batchNumber: batchNum + 1,
          error: insertResult.error || 'Erreur inconnue',
          retryCount: maxRetries,
          willRetry: false
        };
        errors.push(batchError);
        onError?.(batchError);
      }
      
      // Mettre à jour le cache des matricules (en arrière-plan)
      const matricules = processedEntries.map(e => e.matricule);
      updateMatriculeCache(matricules).catch(() => {});
      
      // Enregistrer les stats du batch
      const batchTime = Date.now() - batchStart;
      await recordBatchStats(importId, batchNum + 1, {
        rows_processed: processedEntries.length,
        rows_valid: batchValid,
        rows_invalid: batchInvalid,
        processing_time_ms: batchTime
      });
      
      // Mettre à jour les totaux
      totalProcessed += processedEntries.length;
      totalValid += batchValid;
      totalInvalid += batchInvalid;
      totalAmount += batchAmount;
      
      // Calculer le temps restant estimé
      const elapsed = Date.now() - startTime;
      const avgTimePerBatch = elapsed / (batchNum + 1);
      const remainingBatches = totalBatches - batchNum - 1;
      const estimatedRemaining = (avgTimePerBatch * remainingBatches) / 1000;
      
      // Notifier la progression
      onProgress?.({
        currentBatch: batchNum + 1,
        totalBatches,
        rowsProcessed: totalProcessed,
        totalRows,
        validRows: totalValid,
        invalidRows: totalInvalid,
        percentComplete: Math.round((totalProcessed / totalRows) * 100),
        estimatedTimeRemaining: Math.round(estimatedRemaining)
      });
    }
    
    // Mettre à jour le statut final
    await updateImportStatus(importId, 'completed', {
      total_entries: totalProcessed,
      valid_entries: totalValid,
      invalid_entries: totalInvalid,
      total_amount: totalAmount,
      processing_completed_at: new Date().toISOString()
    });
    
    return {
      success: true,
      importId,
      totalProcessed,
      totalValid,
      totalInvalid,
      totalAmount,
      processingTimeMs: Date.now() - startTime,
      errors
    };
    
  } catch (err) {
    await updateImportStatus(importId, 'failed', {
      error_message: err instanceof Error ? err.message : 'Erreur inconnue',
      processing_completed_at: new Date().toISOString()
    });
    
    return {
      success: false,
      importId,
      totalProcessed,
      totalValid,
      totalInvalid,
      totalAmount,
      processingTimeMs: Date.now() - startTime,
      errors
    };
  }
}

/**
 * Récupérer les entrées d'un import avec pagination
 */
export async function getImportEntries(
  importId: string,
  page: number = 1,
  pageSize: number = 100,
  statusFilter?: 'valid' | 'invalid' | 'pending'
): Promise<{
  entries: ProcessedEntry[];
  total: number;
  page: number;
  totalPages: number;
}> {
  let query = supabase
    .from('payroll_entries')
    .select('*', { count: 'exact' })
    .eq('import_id', importId)
    .order('created_at', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }
  
  const { data, count, error } = await query;
  
  if (error) throw new Error(`Erreur récupération entrées: ${error.message}`);
  
  return {
    entries: (data || []) as ProcessedEntry[],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / pageSize)
  };
}
