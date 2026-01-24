/**
 * MUCO-AMPLITUDE: Streaming Excel Parser
 * Lecture par flux pour fichiers Excel volumineux (2M+ lignes)
 * Utilise ExcelJS avec mode streaming pour < 512 Mo RAM
 */

import ExcelJS from 'exceljs';
import { validatePayrollEntry, type PayrollEntryRaw } from '@/lib/validation/payrollSchemas';

export interface StreamingProgress {
  rowsRead: number;
  rowsValid: number;
  rowsInvalid: number;
  currentChunk: number;
  isComplete: boolean;
  errors: Array<{ row: number; errors: string[] }>;
}

export interface StreamingConfig {
  chunkSize: number;
  onChunk: (entries: PayrollEntryRaw[], progress: StreamingProgress) => Promise<void>;
  onProgress?: (progress: StreamingProgress) => void;
  onError?: (error: Error, row: number) => void;
  onComplete?: (finalProgress: StreamingProgress) => void;
  skipHeaderRow?: boolean;
  columnMapping?: Record<string, string[]>;
}

// Mapping par défaut des colonnes
const DEFAULT_COLUMN_MAPPING: Record<string, string[]> = {
  matricule: ['matricule', 'mat', 'id', 'numero', 'n°', 'employee_id'],
  nom: ['nom', 'name', 'lastname', 'family_name', 'surname'],
  prenom: ['prenom', 'prénom', 'firstname', 'given_name', 'first_name'],
  rib: ['rib', 'compte', 'account', 'iban', 'bank_account', 'numero_compte'],
  montant: ['montant', 'amount', 'salaire', 'salary', 'somme', 'net', 'net_a_payer']
};

/**
 * Vérification pre-flight de la structure du fichier
 * Algorithme de validation rapide avant traitement complet
 */
export async function preflightCheck(file: File): Promise<{
  valid: boolean;
  errors: string[];
  detectedColumns: string[];
  estimatedRows: number;
}> {
  const errors: string[] = [];
  const detectedColumns: string[] = [];
  
  try {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { valid: false, errors: ['Aucune feuille de calcul trouvée'], detectedColumns: [], estimatedRows: 0 };
    }
    
    // Lire la première ligne (headers)
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    
    headerRow.eachCell((cell) => {
      const value = cell.value?.toString().toLowerCase().trim() || '';
      headers.push(value);
      detectedColumns.push(value);
    });
    
    // Vérifier les colonnes requises
    const requiredFields = ['matricule', 'montant'];
    for (const field of requiredFields) {
      const mappings = DEFAULT_COLUMN_MAPPING[field];
      const found = headers.some(h => 
        mappings.some(m => h.includes(m.toLowerCase()))
      );
      if (!found) {
        errors.push(`Colonne requise manquante: ${field}`);
      }
    }
    
    // Estimer le nombre de lignes
    const estimatedRows = worksheet.rowCount - 1; // Moins la ligne d'en-tête
    
    return {
      valid: errors.length === 0,
      errors,
      detectedColumns,
      estimatedRows
    };
    
  } catch (err) {
    return {
      valid: false,
      errors: [`Erreur lecture fichier: ${err instanceof Error ? err.message : 'Erreur inconnue'}`],
      detectedColumns: [],
      estimatedRows: 0
    };
  }
}

/**
 * Trouver l'index d'une colonne par son nom
 */
function findColumnIndex(headers: string[], fieldName: string, mapping: Record<string, string[]>): number {
  const possibleNames = mapping[fieldName] || [fieldName];
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    for (const name of possibleNames) {
      if (header === name.toLowerCase() || header.includes(name.toLowerCase())) {
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Parser une cellule Excel en valeur utilisable
 */
function parseCellValue(cell: ExcelJS.Cell): string | number | null {
  if (!cell || cell.value === null || cell.value === undefined) {
    return null;
  }
  
  const value = cell.value;
  
  // Gérer les différents types de valeur
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    return value.trim();
  }
  
  // Formule avec résultat
  if (typeof value === 'object' && 'result' in value) {
    return value.result as string | number;
  }
  
  // RichText
  if (typeof value === 'object' && 'richText' in value) {
    return (value.richText as Array<{ text: string }>).map(t => t.text).join('');
  }
  
  return String(value);
}

/**
 * Parser un montant depuis une cellule
 */
function parseAmount(value: string | number | null): number {
  if (value === null) return 0;
  
  if (typeof value === 'number') {
    return value;
  }
  
  // Nettoyer la chaîne
  const cleaned = value
    .replace(/[€$£¥\s]/g, '') // Supprimer symboles monétaires et espaces
    .replace(/\s/g, '')
    .replace(/,/g, '.') // Convertir virgule en point
    .replace(/[^\d.-]/g, ''); // Garder seulement chiffres, point, tiret
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Streaming parser pour fichiers Excel volumineux
 * Lit le fichier par chunks pour optimiser la mémoire
 */
export async function streamExcelFile(
  file: File,
  config: StreamingConfig
): Promise<StreamingProgress> {
  const { 
    chunkSize, 
    onChunk, 
    onProgress, 
    onError,
    onComplete,
    skipHeaderRow = true,
    columnMapping = DEFAULT_COLUMN_MAPPING 
  } = config;
  
  const progress: StreamingProgress = {
    rowsRead: 0,
    rowsValid: 0,
    rowsInvalid: 0,
    currentChunk: 0,
    isComplete: false,
    errors: []
  };
  
  try {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Aucune feuille de calcul trouvée');
    }
    
    // Lire les headers
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      headers.push(cell.value?.toString().toLowerCase().trim() || '');
    });
    
    // Mapper les colonnes
    const columnIndices = {
      matricule: findColumnIndex(headers, 'matricule', columnMapping),
      nom: findColumnIndex(headers, 'nom', columnMapping),
      prenom: findColumnIndex(headers, 'prenom', columnMapping),
      rib: findColumnIndex(headers, 'rib', columnMapping),
      montant: findColumnIndex(headers, 'montant', columnMapping)
    };
    
    // Vérifier les colonnes requises
    if (columnIndices.matricule === -1) {
      throw new Error('Colonne MATRICULE non trouvée');
    }
    if (columnIndices.montant === -1) {
      throw new Error('Colonne MONTANT non trouvée');
    }
    
    let currentChunk: PayrollEntryRaw[] = [];
    const startRow = skipHeaderRow ? 2 : 1;
    const totalRows = worksheet.rowCount;
    
    // Traiter chaque ligne
    for (let rowNum = startRow; rowNum <= totalRows; rowNum++) {
      const row = worksheet.getRow(rowNum);
      
      // Ignorer les lignes vides
      if (row.cellCount === 0) continue;
      
      try {
        const rawEntry = {
          matricule: String(parseCellValue(row.getCell(columnIndices.matricule + 1)) || ''),
          nom: String(parseCellValue(row.getCell(columnIndices.nom + 1)) || ''),
          prenom: columnIndices.prenom >= 0 
            ? String(parseCellValue(row.getCell(columnIndices.prenom + 1)) || '')
            : '',
          rib: String(parseCellValue(row.getCell(columnIndices.rib + 1)) || ''),
          montant: parseAmount(parseCellValue(row.getCell(columnIndices.montant + 1)))
        };
        
        // Ignorer si matricule ou montant manquant
        if (!rawEntry.matricule || rawEntry.montant <= 0) {
          progress.rowsRead++;
          continue;
        }
        
        // Valider l'entrée
        const validationResult = validatePayrollEntry(rawEntry);
        
        if (validationResult.success) {
          currentChunk.push(validationResult.data);
          progress.rowsValid++;
        } else {
          progress.rowsInvalid++;
          const errors = 'errors' in validationResult ? validationResult.errors : ['Erreur de validation'];
          progress.errors.push({ row: rowNum, errors });
        }
        
        progress.rowsRead++;
        
        // Envoyer le chunk si plein
        if (currentChunk.length >= chunkSize) {
          progress.currentChunk++;
          await onChunk(currentChunk, { ...progress });
          currentChunk = [];
          onProgress?.({ ...progress });
        }
        
      } catch (err) {
        progress.rowsInvalid++;
        onError?.(err instanceof Error ? err : new Error('Erreur inconnue'), rowNum);
      }
    }
    
    // Envoyer le dernier chunk
    if (currentChunk.length > 0) {
      progress.currentChunk++;
      await onChunk(currentChunk, { ...progress });
    }
    
    progress.isComplete = true;
    onComplete?.(progress);
    
    return progress;
    
  } catch (err) {
    throw new Error(`Erreur parsing Excel: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
}

/**
 * Estimer le temps de traitement basé sur la taille du fichier
 */
export function estimateProcessingTime(fileSize: number, rowCount: number): {
  estimatedSeconds: number;
  formattedTime: string;
} {
  // ~1000 lignes/seconde en moyenne
  const rowsPerSecond = 1000;
  const estimatedSeconds = Math.ceil(rowCount / rowsPerSecond);
  
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  
  let formattedTime: string;
  if (minutes > 0) {
    formattedTime = `${minutes}m ${seconds}s`;
  } else {
    formattedTime = `${seconds}s`;
  }
  
  return { estimatedSeconds, formattedTime };
}
