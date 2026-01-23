import { RIBComponents } from '@/types/payroll';

/**
 * Validates a French RIB (Relevé d'Identité Bancaire) using the Modulo 97 algorithm
 * Format: BBBBB GGGGG CCCCCCCCCCC KK
 * B = Code Banque (5 digits)
 * G = Code Guichet (5 digits)
 * C = Numéro de Compte (11 alphanumeric)
 * K = Clé RIB (2 digits)
 */

// Letter to number conversion table for RIB validation
const LETTER_VALUES: Record<string, number> = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8, 'I': 9,
  'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'O': 6, 'P': 7, 'Q': 8, 'R': 9,
  'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
};

/**
 * Convert a letter to its numeric equivalent for RIB calculation
 */
function letterToNumber(char: string): string {
  const upper = char.toUpperCase();
  if (LETTER_VALUES[upper] !== undefined) {
    return LETTER_VALUES[upper].toString();
  }
  return char;
}

/**
 * Convert account number with letters to numeric string
 */
function convertToNumeric(value: string): string {
  return value.split('').map(letterToNumber).join('');
}

/**
 * Parse a RIB string into its components
 */
export function parseRIB(rib: string): RIBComponents | null {
  // Remove all spaces and special characters
  const cleanRIB = rib.replace(/[\s.-]/g, '').toUpperCase();
  
  // RIB should be exactly 23 characters
  if (cleanRIB.length !== 23) {
    return null;
  }
  
  return {
    codeBanque: cleanRIB.substring(0, 5),
    codeGuichet: cleanRIB.substring(5, 10),
    numeroCompte: cleanRIB.substring(10, 21),
    cleRIB: cleanRIB.substring(21, 23)
  };
}

/**
 * Validate RIB using Modulo 97 algorithm
 * Formula: 97 - ((89 * B + 15 * G + 3 * C) mod 97) = K
 */
export function validateRIB(rib: string): { valid: boolean; error?: string } {
  const cleanRIB = rib.replace(/[\s.-]/g, '').toUpperCase();
  
  // Check length
  if (cleanRIB.length !== 23) {
    return { 
      valid: false, 
      error: `Longueur invalide: ${cleanRIB.length} caractères (attendu: 23)` 
    };
  }
  
  const components = parseRIB(cleanRIB);
  if (!components) {
    return { valid: false, error: 'Format RIB invalide' };
  }
  
  // Validate code banque (5 digits)
  if (!/^\d{5}$/.test(components.codeBanque)) {
    return { valid: false, error: 'Code banque invalide (5 chiffres requis)' };
  }
  
  // Validate code guichet (5 digits)
  if (!/^\d{5}$/.test(components.codeGuichet)) {
    return { valid: false, error: 'Code guichet invalide (5 chiffres requis)' };
  }
  
  // Validate clé RIB (2 digits, 01-97)
  if (!/^\d{2}$/.test(components.cleRIB)) {
    return { valid: false, error: 'Clé RIB invalide (2 chiffres requis)' };
  }
  
  const cleValue = parseInt(components.cleRIB, 10);
  if (cleValue < 1 || cleValue > 97) {
    return { valid: false, error: 'Clé RIB hors plage (01-97)' };
  }
  
  // Convert letters in account number to numbers
  const numericCompte = convertToNumeric(components.numeroCompte);
  
  // Calculate checksum using Modulo 97
  // Concatenate: codeBanque + codeGuichet + numeroCompte + cleRIB
  const fullNumeric = components.codeBanque + components.codeGuichet + numericCompte + components.cleRIB;
  
  // Use BigInt for large number calculation
  try {
    const bigValue = BigInt(fullNumeric);
    const remainder = bigValue % BigInt(97);
    
    if (remainder !== BigInt(0)) {
      return { 
        valid: false, 
        error: `Clé RIB incorrecte (modulo 97 ≠ 0)` 
      };
    }
  } catch {
    return { valid: false, error: 'Erreur de calcul de validation' };
  }
  
  return { valid: true };
}

/**
 * Format RIB for display with spaces
 */
export function formatRIB(rib: string): string {
  const cleanRIB = rib.replace(/[\s.-]/g, '').toUpperCase();
  if (cleanRIB.length !== 23) return rib;
  
  return `${cleanRIB.substring(0, 5)} ${cleanRIB.substring(5, 10)} ${cleanRIB.substring(10, 21)} ${cleanRIB.substring(21, 23)}`;
}

/**
 * Generate a valid RIB key from bank details (for testing purposes)
 */
export function calculateRIBKey(codeBanque: string, codeGuichet: string, numeroCompte: string): string {
  const numericCompte = convertToNumeric(numeroCompte);
  const fullNumeric = codeBanque + codeGuichet + numericCompte + '00';
  
  try {
    const bigValue = BigInt(fullNumeric);
    const remainder = bigValue % BigInt(97);
    const key = 97 - Number(remainder);
    return key.toString().padStart(2, '0');
  } catch {
    return '00';
  }
}
