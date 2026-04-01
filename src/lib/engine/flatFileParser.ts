/**
 * MUCODEC Flat File Parser
 * Parses payroll flat files with:
 * - Type 1: Header line (date, caisse, debit account, totals, company)
 * - Type 2: Detail lines (employee name, RIB, encoded amount, label)
 */

export interface FlatFileHeader {
  type: 1;
  periode: string;        // ex: "0326" → Mars 2026
  codeCaisse: string;     // ex: "CFD"
  ville: string;          // ex: "BZV"
  compteDebiteur: string; // ex: "300050019738100300000"
  nombreSalaries: number;
  montantTotal: number;
  nomEntreprise: string;
  avecFrais: boolean;     // determined from debit account
}

export interface FlatFileDetail {
  type: 2;
  nomComplet: string;
  rib: string;
  montant: number;
  montantBrut: string;    // raw encoded string
  libelle: string;        // ex: "HOTLEON_SAL_0326"
  isValid: boolean;
  invalidReason?: string;
  redirected: boolean;    // true if redirected to technical account
  ribOriginal?: string;   // original RIB before redirect
}

export interface FlatFileParseResult {
  header: FlatFileHeader;
  details: FlatFileDetail[];
  validDetails: FlatFileDetail[];
  invalidDetails: FlatFileDetail[];
  redirectedDetails: FlatFileDetail[];
  totalParsed: number;
  totalValid: number;
  totalInvalid: number;
  totalRedirected: number;
  montantTotalDetails: number;
  coherenceOk: boolean;
  coherenceMessage: string;
  rejectionLog: RejectionLogEntry[];
}

export interface RejectionLogEntry {
  nomComplet: string;
  ribOriginal: string;
  montant: number;
  reason: string;
  action: string; // 'REJECTED' | 'REDIRECTED'
  redirectedTo?: string;
}

const COMPTE_TECHNIQUE = '38100000000';
const COMPTE_AVEC_FRAIS = '300050019738100300000';
const COMPTE_SANS_FRAIS = '300050019738100000000';

/**
 * Extract the actual amount from an encoded numeric string
 * Ex: "9100000000000000148146" → 148146
 * The amount is the trailing significant digits after the prefix
 */
export function extractMontant(encodedStr: string): number {
  if (!encodedStr || encodedStr.trim() === '') return 0;
  
  const cleaned = encodedStr.replace(/\s/g, '');
  
  // If it's a simple number, return it
  if (/^\d{1,10}$/.test(cleaned)) {
    return parseInt(cleaned, 10);
  }
  
  // For long encoded strings: strip leading '9' and trailing zeros prefix
  // Pattern: prefix of 9s and 0s, then the actual amount
  // Ex: "9100000000000000148146" → last meaningful digits = 148146
  const match = cleaned.match(/^9[01]*0*(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Fallback: try to extract trailing non-zero digits
  const trailingMatch = cleaned.match(/0{3,}(\d{3,})$/);
  if (trailingMatch) {
    return parseInt(trailingMatch[1], 10);
  }
  
  // Last resort: parse the whole thing
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Determine if a debit account indicates "with fees"
 */
export function isAvecFrais(compteDebiteur: string): boolean {
  return compteDebiteur.trim() === COMPTE_AVEC_FRAIS;
}

/**
 * Validate a RIB/CCO account number
 * Returns null if valid, error message if invalid
 */
function validateAccount(rib: string): string | null {
  if (!rib || rib.trim() === '') {
    return 'Absence de CCO';
  }
  
  const cleaned = rib.replace(/\s/g, '');
  
  if (cleaned.length < 11) {
    return 'Numéro de compte trop court';
  }
  
  // Check for obviously invalid patterns (all zeros, etc.)
  if (/^0+$/.test(cleaned)) {
    return 'Compte incorrect (tous zéros)';
  }
  
  return null;
}

/**
 * Parse a MUCODEC flat file content
 */
export function parseFlatFile(content: string): FlatFileParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  
  if (lines.length < 2) {
    throw new Error('Fichier invalide: au moins 2 lignes requises (entête + détail)');
  }

  // Parse header (first line - type 1)
  const header = parseHeaderLine(lines[0]);
  
  // Parse detail lines (type 2)
  const details: FlatFileDetail[] = [];
  const rejectionLog: RejectionLogEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const detail = parseDetailLine(line);
    
    // Validate account
    const accountError = validateAccount(detail.rib);
    if (accountError) {
      detail.isValid = false;
      detail.invalidReason = accountError;
      detail.redirected = true;
      detail.ribOriginal = detail.rib;
      detail.rib = COMPTE_TECHNIQUE;
      
      rejectionLog.push({
        nomComplet: detail.nomComplet,
        ribOriginal: detail.ribOriginal || '',
        montant: detail.montant,
        reason: accountError,
        action: 'REDIRECTED',
        redirectedTo: COMPTE_TECHNIQUE,
      });
    }
    
    details.push(detail);
  }

  const validDetails = details.filter(d => d.isValid);
  const invalidDetails = details.filter(d => !d.isValid);
  const redirectedDetails = details.filter(d => d.redirected);
  
  const montantTotalDetails = details.reduce((s, d) => s + d.montant, 0);
  
  // Coherence check: header total vs sum of details
  const diff = Math.abs(header.montantTotal - montantTotalDetails);
  const coherenceOk = diff < 1; // Allow 1 XAF rounding
  const coherenceMessage = coherenceOk
    ? `Cohérence OK: ${header.montantTotal.toLocaleString('fr-FR')} XAF`
    : `INCOHÉRENCE: Entête=${header.montantTotal.toLocaleString('fr-FR')} XAF vs Détails=${montantTotalDetails.toLocaleString('fr-FR')} XAF (Δ=${diff.toLocaleString('fr-FR')} XAF)`;
  
  // Check number of transactions
  if (header.nombreSalaries !== details.length) {
    rejectionLog.push({
      nomComplet: 'ENTÊTE',
      ribOriginal: '',
      montant: 0,
      reason: `Nombre salariés entête (${header.nombreSalaries}) ≠ lignes détail (${details.length})`,
      action: 'REJECTED',
    });
  }

  return {
    header,
    details,
    validDetails,
    invalidDetails,
    redirectedDetails,
    totalParsed: details.length,
    totalValid: validDetails.length,
    totalInvalid: invalidDetails.length,
    totalRedirected: redirectedDetails.length,
    montantTotalDetails,
    coherenceOk,
    coherenceMessage,
    rejectionLog,
  };
}

/**
 * Parse a type 1 (header) line
 * Flexible parsing — fields separated by delimiter or fixed positions
 */
function parseHeaderLine(line: string): FlatFileHeader {
  // Try tab/semicolon/pipe delimiter first
  let fields: string[];
  if (line.includes('\t')) {
    fields = line.split('\t');
  } else if (line.includes(';')) {
    fields = line.split(';');
  } else if (line.includes('|')) {
    fields = line.split('|');
  } else {
    // Fixed position: split by multiple spaces
    fields = line.split(/\s{2,}/);
  }
  
  fields = fields.map(f => f.trim()).filter(f => f !== '');
  
  // Extract fields — adapting to different possible orderings
  // Expected: Type, Periode, CodeCaisse, Ville, CompteDebiteur, NbSalaries, MontantTotal, NomEntreprise
  const compteDebiteur = fields.find(f => f.length >= 20 && /^\d+$/.test(f)) || '';
  const periode = fields.find(f => /^\d{4}$/.test(f) && parseInt(f) < 1300) || fields[1] || '';
  const nomEntreprise = fields[fields.length - 1] || 'ENTREPRISE';
  
  // Find numeric fields for count and total
  const numericFields = fields.filter(f => /^\d+$/.test(f) && f !== periode && f !== compteDebiteur && f !== '1');
  
  let nombreSalaries = 0;
  let montantTotal = 0;
  
  if (numericFields.length >= 2) {
    // Smaller number = count, larger = amount
    const nums = numericFields.map(n => parseInt(n, 10)).sort((a, b) => a - b);
    nombreSalaries = nums[0];
    montantTotal = nums[nums.length - 1];
  } else if (numericFields.length === 1) {
    montantTotal = parseInt(numericFields[0], 10);
  }
  
  // Detect code caisse and ville (short alphabetic fields)
  const alphaFields = fields.filter(f => /^[A-Z]{2,5}$/.test(f));
  const codeCaisse = alphaFields[0] || '';
  const ville = alphaFields[1] || '';

  return {
    type: 1,
    periode,
    codeCaisse,
    ville,
    compteDebiteur,
    nombreSalaries,
    montantTotal,
    nomEntreprise,
    avecFrais: isAvecFrais(compteDebiteur),
  };
}

/**
 * Parse a type 2 (detail) line
 */
function parseDetailLine(line: string): FlatFileDetail {
  let fields: string[];
  if (line.includes('\t')) {
    fields = line.split('\t');
  } else if (line.includes(';')) {
    fields = line.split(';');
  } else if (line.includes('|')) {
    fields = line.split('|');
  } else {
    fields = line.split(/\s{2,}/);
  }
  
  fields = fields.map(f => f.trim()).filter(f => f !== '');
  
  // Find fields by pattern
  // Name: alphabetic with spaces
  // RIB: long numeric (11-23 digits)
  // Amount: very long numeric or standard numeric
  // Label: contains underscore pattern like "HOTLEON_SAL_0326"
  
  const labelField = fields.find(f => /_/.test(f)) || '';
  const numericFields = fields.filter(f => /^\d+$/.test(f));
  
  // RIB is typically 11-23 digits
  const ribField = numericFields.find(f => f.length >= 11 && f.length <= 23) || '';
  
  // Amount: either the longest numeric field or one with encoded pattern
  const amountField = numericFields.find(f => f.length > 15) || 
                      numericFields.find(f => f !== ribField && parseInt(f, 10) > 0) || '';
  
  const montant = extractMontant(amountField);
  
  // Name: first non-numeric, non-label field
  const nameFields = fields.filter(f => 
    !/^\d+$/.test(f) && !/_/.test(f) && f.length > 2
  );
  const nomComplet = nameFields[0] || 'INCONNU';

  return {
    type: 2,
    nomComplet,
    rib: ribField,
    montant,
    montantBrut: amountField,
    libelle: labelField,
    isValid: true,
    redirected: false,
  };
}
