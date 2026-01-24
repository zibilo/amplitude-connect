/**
 * MUCO-AMPLITUDE: Schémas de validation Zod
 * Validation robuste pour rejeter les données mal formatées
 */

import { z } from 'zod';

// Regex patterns pour validation
const MATRICULE_REGEX = /^[A-Z0-9]{1,20}$/i;
const RIB_REGEX = /^[A-Z0-9]{23}$/i;
const CODE_BANQUE_REGEX = /^\d{5}$/;
const CODE_GUICHET_REGEX = /^\d{5}$/;
const CLE_RIB_REGEX = /^\d{2}$/;

// Schéma pour une entrée de paie brute (avant validation RIB)
export const PayrollEntryRawSchema = z.object({
  matricule: z.string()
    .min(1, 'Matricule requis')
    .max(20, 'Matricule trop long (max 20 caractères)')
    .regex(MATRICULE_REGEX, 'Format matricule invalide'),
  
  nom: z.string()
    .min(1, 'Nom requis')
    .max(100, 'Nom trop long (max 100 caractères)')
    .transform(val => val.toUpperCase().trim()),
  
  prenom: z.string()
    .max(100, 'Prénom trop long')
    .optional()
    .transform(val => val?.trim() || ''),
  
  rib: z.string()
    .min(23, 'RIB trop court (23 caractères requis)')
    .max(30, 'RIB trop long')
    .transform(val => val.replace(/[\s.-]/g, '').toUpperCase()),
  
  montant: z.union([
    z.number().positive('Montant doit être positif'),
    z.string().transform((val, ctx) => {
      const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Montant invalide ou non positif'
        });
        return z.NEVER;
      }
      return parsed;
    })
  ])
});

// Schéma pour une entrée de paie validée (après validation RIB)
export const PayrollEntryValidatedSchema = PayrollEntryRawSchema.extend({
  id: z.string().uuid().optional(),
  code_banque: z.string().regex(CODE_BANQUE_REGEX).optional(),
  code_guichet: z.string().regex(CODE_GUICHET_REGEX).optional(),
  numero_compte: z.string().max(11).optional(),
  cle_rib: z.string().regex(CLE_RIB_REGEX).optional(),
  rib_valid: z.boolean(),
  rib_error: z.string().optional(),
  account_exists: z.boolean().optional(),
  status: z.enum(['pending', 'valid', 'invalid', 'processed', 'rejected']),
  batch_number: z.number().int().positive().optional()
});

// Schéma pour l'import de fichier
export const ImportConfigSchema = z.object({
  batchSize: z.number().int().min(100).max(10000).default(5000),
  validateRib: z.boolean().default(true),
  checkAccountExists: z.boolean().default(false),
  skipInvalid: z.boolean().default(false),
  maxRetries: z.number().int().min(0).max(10).default(3)
});

// Schéma pour la configuration système
export const SystemConfigSchema = z.object({
  batch_size: z.number().int().positive(),
  max_retries: z.number().int().min(0),
  output_path: z.string(),
  oracle_timeout: z.number().int().positive(),
  stream_chunk_size: z.number().int().positive()
});

// Schéma pour les statistiques de traitement
export const ProcessingStatsSchema = z.object({
  import_id: z.string().uuid(),
  batch_number: z.number().int().positive(),
  rows_processed: z.number().int().min(0),
  rows_valid: z.number().int().min(0),
  rows_invalid: z.number().int().min(0),
  processing_time_ms: z.number().int().min(0),
  memory_used_mb: z.number().min(0).optional()
});

// Schéma pour les fichiers générés
export const GeneratedFileSchema = z.object({
  file_type: z.enum(['xml', 'flat']),
  file_format: z.enum(['MVTI_008', 'INT-VIRMU2']),
  file_name: z.string().min(1),
  entries_count: z.number().int().min(0),
  total_amount: z.number().min(0),
  destination_path: z.string().default('C:\\ODTSF\\')
});

// Schéma pour les entrées de réconciliation
export const ReconciliationEntrySchema = z.object({
  rib: z.string().regex(RIB_REGEX),
  nom: z.string().optional(),
  montant_envoye: z.number().positive(),
  montant_recu: z.number().optional(),
  status: z.enum(['pending', 'success', 'rejected', 'unmatched']),
  motif_rejet: z.string().optional(),
  code_rejet: z.string().optional(),
  date_compensation: z.date().optional()
});

// Schéma pour l'audit log
export const AuditLogSchema = z.object({
  action: z.enum(['import', 'export', 'validation', 'reconciliation', 'generation', 'transfer', 'error', 'system']),
  severity: z.enum(['debug', 'info', 'warning', 'error', 'critical']).default('info'),
  description: z.string().min(1).max(500),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  details: z.record(z.unknown()).optional()
});

// Types inférés
export type PayrollEntryRaw = z.infer<typeof PayrollEntryRawSchema>;
export type PayrollEntryValidated = z.infer<typeof PayrollEntryValidatedSchema>;
export type ImportConfig = z.infer<typeof ImportConfigSchema>;
export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type ProcessingStats = z.infer<typeof ProcessingStatsSchema>;
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;
export type ReconciliationEntry = z.infer<typeof ReconciliationEntrySchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;

// Résultat de validation typé
export type ValidationResult = 
  | { success: true; data: PayrollEntryRaw }
  | { success: false; errors: string[] };

// Helper pour valider une ligne avec gestion d'erreur
export function validatePayrollEntry(row: unknown): ValidationResult {
  const result = PayrollEntryRawSchema.safeParse(row);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  };
}

// Helper pour valider un batch
export function validatePayrollBatch(rows: unknown[]): {
  valid: PayrollEntryRaw[];
  invalid: Array<{ row: unknown; errors: string[] }>;
} {
  const valid: PayrollEntryRaw[] = [];
  const invalid: Array<{ row: unknown; errors: string[] }> = [];
  
  for (const row of rows) {
    const result = validatePayrollEntry(row);
    if (result.success === true) {
      valid.push(result.data);
    } else {
      invalid.push({ row, errors: (result as { success: false; errors: string[] }).errors });
    }
  }
  
  return { valid, invalid };
}
