/**
 * MUCO-AMPLITUDE: Audit Logger
 * Traçabilité complète des actions utilisateur
 */

import { supabase } from '@/integrations/supabase/client';
import { generateSessionId } from '@/lib/security/hashUtils';
import type { AuditLog } from '@/lib/validation/payrollSchemas';

// Session ID persistant pour la durée de vie de l'application
let currentSessionId: string | null = null;

/**
 * Obtenir ou créer un ID de session
 */
export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = generateSessionId();
  }
  return currentSessionId;
}

/**
 * Réinitialiser la session
 */
export function resetSession(): void {
  currentSessionId = null;
}

/**
 * Enregistrer un événement d'audit
 */
export async function logAudit(
  action: AuditLog['action'],
  description: string,
  options?: {
    severity?: AuditLog['severity'];
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        session_id: getSessionId(),
        action,
        description,
        severity: options?.severity || 'info',
        entity_type: options?.entityType,
        entity_id: options?.entityId,
        details: options?.details ? JSON.parse(JSON.stringify(options.details)) : {},
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      }]);
    
    if (error) {
      console.error('Erreur audit log:', error);
    }
  } catch (err) {
    console.error('Erreur enregistrement audit:', err);
  }
}

/**
 * Logger pour les imports
 */
export const importLogger = {
  started: (fileName: string, fileSize: number) => logAudit(
    'import',
    `Début import fichier: ${fileName}`,
    {
      severity: 'info',
      details: { fileName, fileSize, stage: 'started' }
    }
  ),
  
  progress: (importId: string, progress: number, rowsProcessed: number) => logAudit(
    'import',
    `Import en cours: ${progress}%`,
    {
      severity: 'debug',
      entityType: 'payroll_import',
      entityId: importId,
      details: { progress, rowsProcessed, stage: 'processing' }
    }
  ),
  
  completed: (importId: string, stats: { total: number; valid: number; invalid: number; amount: number }) => logAudit(
    'import',
    `Import terminé: ${stats.total} lignes (${stats.valid} valides, ${stats.invalid} invalides)`,
    {
      severity: 'info',
      entityType: 'payroll_import',
      entityId: importId,
      details: { ...stats, stage: 'completed' }
    }
  ),
  
  failed: (importId: string, error: string) => logAudit(
    'error',
    `Échec import: ${error}`,
    {
      severity: 'error',
      entityType: 'payroll_import',
      entityId: importId,
      details: { error, stage: 'failed' }
    }
  )
};

/**
 * Logger pour la validation
 */
export const validationLogger = {
  ribValid: (rib: string, matricule: string) => logAudit(
    'validation',
    `RIB validé pour matricule ${matricule}`,
    {
      severity: 'debug',
      details: { ribMasked: rib.substring(0, 5) + '***', matricule }
    }
  ),
  
  ribInvalid: (rib: string, matricule: string, reason: string) => logAudit(
    'validation',
    `RIB invalide pour matricule ${matricule}: ${reason}`,
    {
      severity: 'warning',
      details: { ribMasked: rib.substring(0, 5) + '***', matricule, reason }
    }
  ),
  
  preflightPassed: (fileName: string, columns: string[]) => logAudit(
    'validation',
    `Vérification pre-flight réussie: ${fileName}`,
    {
      severity: 'info',
      details: { fileName, detectedColumns: columns }
    }
  ),
  
  preflightFailed: (fileName: string, errors: string[]) => logAudit(
    'validation',
    `Vérification pre-flight échouée: ${fileName}`,
    {
      severity: 'error',
      details: { fileName, errors }
    }
  )
};

/**
 * Logger pour la génération de fichiers
 */
export const generationLogger = {
  started: (format: string, entriesCount: number) => logAudit(
    'generation',
    `Début génération fichier ${format}`,
    {
      severity: 'info',
      details: { format, entriesCount, stage: 'started' }
    }
  ),
  
  completed: (fileId: string, fileName: string, hash: string) => logAudit(
    'generation',
    `Fichier généré: ${fileName}`,
    {
      severity: 'info',
      entityType: 'generated_file',
      entityId: fileId,
      details: { fileName, hash, stage: 'completed' }
    }
  ),
  
  transferred: (fileId: string, destination: string) => logAudit(
    'transfer',
    `Fichier transféré vers ${destination}`,
    {
      severity: 'info',
      entityType: 'generated_file',
      entityId: fileId,
      details: { destination, stage: 'transferred' }
    }
  )
};

/**
 * Logger pour la réconciliation
 */
export const reconciliationLogger = {
  started: (fileName: string) => logAudit(
    'reconciliation',
    `Début réconciliation: ${fileName}`,
    {
      severity: 'info',
      details: { fileName, stage: 'started' }
    }
  ),
  
  completed: (reportId: string, stats: { matched: number; unmatched: number; successRate: number }) => logAudit(
    'reconciliation',
    `Réconciliation terminée: ${stats.successRate}% succès`,
    {
      severity: 'info',
      entityType: 'reconciliation_report',
      entityId: reportId,
      details: { ...stats, stage: 'completed' }
    }
  ),
  
  rejected: (rib: string, motif: string) => logAudit(
    'reconciliation',
    `Virement rejeté: ${motif}`,
    {
      severity: 'warning',
      details: { ribMasked: rib.substring(0, 5) + '***', motif }
    }
  )
};

/**
 * Logger système
 */
export const systemLogger = {
  info: (message: string, details?: Record<string, unknown>) => logAudit(
    'system',
    message,
    { severity: 'info', details }
  ),
  
  warning: (message: string, details?: Record<string, unknown>) => logAudit(
    'system',
    message,
    { severity: 'warning', details }
  ),
  
  error: (message: string, error?: Error | string, details?: Record<string, unknown>) => logAudit(
    'error',
    message,
    {
      severity: 'error',
      details: {
        ...details,
        errorMessage: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      }
    }
  ),
  
  critical: (message: string, error?: Error | string, details?: Record<string, unknown>) => logAudit(
    'error',
    message,
    {
      severity: 'critical',
      details: {
        ...details,
        errorMessage: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      }
    }
  )
};

/**
 * Récupérer les logs d'audit avec filtres
 */
export async function getAuditLogs(options?: {
  action?: AuditLog['action'];
  severity?: AuditLog['severity'];
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<Array<{
  id: string;
  session_id: string | null;
  action: string;
  severity: string | null;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown;
  created_at: string;
}>> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100);
  
  if (options?.action) {
    query = query.eq('action', options.action);
  }
  
  if (options?.severity) {
    query = query.eq('severity', options.severity);
  }
  
  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType);
  }
  
  if (options?.entityId) {
    query = query.eq('entity_id', options.entityId);
  }
  
  if (options?.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }
  
  if (options?.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }
  
  const { data, error } = await query;
  
  if (error) throw new Error(`Erreur récupération logs: ${error.message}`);
  
  return data || [];
}
