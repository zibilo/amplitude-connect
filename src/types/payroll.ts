// Types for MUCO-AMPLITUDE Payroll Middleware

export interface PayrollEntry {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  rib: string;
  montant: number;
  ribValid: boolean;
  ribError?: string;
  status: 'valid' | 'invalid' | 'pending';
}

export interface ImportResult {
  entries: PayrollEntry[];
  totalValid: number;
  totalInvalid: number;
  totalAmount: number;
  importDate: Date;
  fileName: string;
}

export interface GeneratedFile {
  id: string;
  type: 'xml' | 'flat';
  format: 'MVTI_008' | 'INT-VIRMU2';
  fileName: string;
  content: string;
  generatedAt: Date;
  entriesCount: number;
  totalAmount: number;
}

export interface ReconciliationEntry {
  id: string;
  rib: string;
  nom: string;
  montantEnvoye: number;
  montantRecu?: number;
  status: 'success' | 'rejected' | 'pending';
  motifRejet?: string;
  dateCompensation?: Date;
}

export interface ReconciliationReport {
  id: string;
  fileName: string;
  importDate: Date;
  entries: ReconciliationEntry[];
  totalEnvoye: number;
  totalRecu: number;
  totalRejete: number;
  tauxSucces: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: 'import' | 'export' | 'validation' | 'reconciliation' | 'error';
  description: string;
  user?: string;
  details?: Record<string, unknown>;
}

// RIB Structure (French bank account number)
export interface RIBComponents {
  codeBanque: string;      // 5 digits
  codeGuichet: string;     // 5 digits
  numeroCompte: string;    // 11 characters
  cleRIB: string;          // 2 digits
}
