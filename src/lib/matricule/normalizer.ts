/**
 * Matricule Normalization and Fuzzy Matching Algorithms
 * Handles sanitization, padding, and intelligent matching
 */

export interface NormalizationResult {
  original: string;
  normalized: string;
  padded: string;
  matchMethod: 'exact' | 'normalized' | 'padded' | 'fuzzy' | 'rib' | 'none';
  confidence: number;
}

/**
 * Sanitize matricule by removing spaces, handling case, and special characters
 */
export function sanitizeMatricule(matricule: string): string {
  if (!matricule) return '';
  
  return matricule
    .toString()
    .trim()
    .replace(/\s+/g, '') // Remove all spaces
    .toUpperCase(); // Case insensitive
}

/**
 * Normalize matricule for database matching
 * Removes non-significant zeros, spaces, and normalizes case
 */
export function normalizeMatricule(matricule: string): string {
  const sanitized = sanitizeMatricule(matricule);
  
  // If purely numeric, remove leading zeros
  if (/^\d+$/.test(sanitized)) {
    return parseInt(sanitized, 10).toString();
  }
  
  return sanitized;
}

/**
 * Pad matricule to expected length (e.g., 7 digits for Amplitude)
 */
export function padMatricule(matricule: string, targetLength: number = 7): string {
  const normalized = normalizeMatricule(matricule);
  
  // Only pad if purely numeric
  if (/^\d+$/.test(normalized)) {
    return normalized.padStart(targetLength, '0');
  }
  
  return normalized;
}

/**
 * Detect matricule format type
 */
export function detectMatriculeFormat(matricule: string): 'numeric' | 'alphanumeric' | 'special' {
  const sanitized = sanitizeMatricule(matricule);
  
  if (/^\d+$/.test(sanitized)) {
    return 'numeric';
  }
  
  if (/^[A-Z0-9]+$/.test(sanitized)) {
    return 'alphanumeric';
  }
  
  return 'special'; // Contains hyphens, slashes, underscores, etc.
}

/**
 * Generate possible variants of a matricule for fuzzy matching
 */
export function generateMatriculeVariants(matricule: string): string[] {
  const variants = new Set<string>();
  const normalized = normalizeMatricule(matricule);
  const sanitized = sanitizeMatricule(matricule);
  
  // Add base variants
  variants.add(matricule.trim());
  variants.add(normalized);
  variants.add(sanitized);
  
  // Add padded versions (5, 6, 7, 8 digits)
  if (/^\d+$/.test(normalized)) {
    for (let len = 5; len <= 8; len++) {
      variants.add(normalized.padStart(len, '0'));
    }
  }
  
  // Add without special characters
  variants.add(sanitized.replace(/[-_\/\\]/g, ''));
  
  // Add lowercase variant
  variants.add(normalized.toLowerCase());
  
  return Array.from(variants).filter(v => v.length > 0);
}

/**
 * Calculate similarity between two matricules (Levenshtein-based)
 */
export function calculateSimilarity(a: string, b: string): number {
  const s1 = normalizeMatricule(a);
  const s2 = normalizeMatricule(b);
  
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Levenshtein distance implementation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Full normalization pipeline returning all variants and match info
 */
export function fullNormalization(matricule: string): NormalizationResult {
  return {
    original: matricule,
    normalized: normalizeMatricule(matricule),
    padded: padMatricule(matricule),
    matchMethod: 'none',
    confidence: 0
  };
}
