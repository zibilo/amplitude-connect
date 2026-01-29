/**
 * Moteur de Réconciliation V1
 * Algorithmes de dé-doublonnage, calcul delta et génération de fichiers
 */

import { mean, standardDeviation } from 'simple-statistics';

// Types
export interface SourceEntry {
  id: string;
  employeeId: string;
  name: string;
  rib: string;
  expectedAmount: number;
  payDate: string;
  reference?: string;
}

export interface CoreBankingEntry {
  id: string;
  employeeId: string;
  name: string;
  rib: string;
  actualAmount: number;
  transactionDate: string;
  transactionId: string;
  status: 'EXECUTED' | 'PENDING' | 'REJECTED';
}

export interface ReconciliationResult {
  employeeId: string;
  name: string;
  rib: string;
  expectedAmount: number;
  actualAmount: number;
  delta: number;
  status: 'MATCH' | 'UNDERPAID' | 'OVERPAID' | 'MISSING' | 'DUPLICATE';
  transactionCount: number;
  transactions: CoreBankingEntry[];
  flagged: boolean;
  flagReason?: string;
}

export interface ReconciliationSummary {
  totalExpected: number;
  totalActual: number;
  totalDelta: number;
  matchCount: number;
  underpaidCount: number;
  overpaidCount: number;
  missingCount: number;
  duplicateCount: number;
  anomalyCount: number;
  results: ReconciliationResult[];
  duplicates: DuplicateEntry[];
  corrections: CorrectionEntry[];
  recoveries: RecoveryEntry[];
}

export interface DuplicateEntry {
  employeeId: string;
  name: string;
  rib: string;
  transactions: CoreBankingEntry[];
  totalPaid: number;
  expectedAmount: number;
  excessAmount: number;
}

export interface CorrectionEntry {
  employeeId: string;
  name: string;
  rib: string;
  missingAmount: number;
  reason: string;
}

export interface RecoveryEntry {
  employeeId: string;
  name: string;
  rib: string;
  excessAmount: number;
  transactions: CoreBankingEntry[];
  reason: string;
}

/**
 * Algorithme de Dé-doublonnage (HashMap Strategy)
 * Complexité O(n) au lieu de O(n²)
 */
export function detectDuplicates(
  entries: CoreBankingEntry[],
  payPeriod: string
): Map<string, CoreBankingEntry[]> {
  const hashMap = new Map<string, CoreBankingEntry[]>();
  
  entries.forEach(entry => {
    // Clé unique: EmployeeID + PayPeriod
    const hash = `${entry.employeeId}_${payPeriod}`;
    
    if (!hashMap.has(hash)) {
      hashMap.set(hash, []);
    }
    hashMap.get(hash)!.push(entry);
  });
  
  // Filtrer pour garder seulement les doublons
  const duplicates = new Map<string, CoreBankingEntry[]>();
  hashMap.forEach((transactions, key) => {
    if (transactions.length > 1) {
      duplicates.set(key, transactions);
    }
  });
  
  return duplicates;
}

/**
 * Algorithme Delta (Régularisation)
 * Calcule: Δi = Montant_Attendu(i) - Σ Montants_Reçus(i)
 */
export function calculateDelta(
  expected: number,
  received: CoreBankingEntry[]
): { delta: number; status: 'MATCH' | 'UNDERPAID' | 'OVERPAID' } {
  const totalReceived = received.reduce((sum, e) => sum + e.actualAmount, 0);
  const delta = expected - totalReceived;
  
  // Tolérance de 1 FCFA pour les arrondis
  const tolerance = 1;
  
  if (Math.abs(delta) <= tolerance) {
    return { delta: 0, status: 'MATCH' };
  } else if (delta > 0) {
    return { delta, status: 'UNDERPAID' };
  } else {
    return { delta: Math.abs(delta), status: 'OVERPAID' };
  }
}

/**
 * Détection d'anomalies statistiques
 * Utilise l'écart-type pour identifier les montants suspects
 */
export function detectAnomalies(amounts: number[]): { mean: number; stdDev: number; threshold: number } {
  if (amounts.length < 2) {
    return { mean: amounts[0] || 0, stdDev: 0, threshold: 0 };
  }
  
  const avg = mean(amounts);
  const std = standardDeviation(amounts);
  
  // Seuil: moyenne ± 2 écarts-types
  return {
    mean: avg,
    stdDev: std,
    threshold: 2 * std
  };
}

/**
 * Moteur Principal de Réconciliation
 */
export function reconcile(
  sourceEntries: SourceEntry[],
  coreBankingEntries: CoreBankingEntry[],
  payPeriod: string
): ReconciliationSummary {
  const results: ReconciliationResult[] = [];
  const duplicates: DuplicateEntry[] = [];
  const corrections: CorrectionEntry[] = [];
  const recoveries: RecoveryEntry[] = [];
  
  // Indexer les transactions du Core Banking par employé
  const cbByEmployee = new Map<string, CoreBankingEntry[]>();
  coreBankingEntries.forEach(entry => {
    if (!cbByEmployee.has(entry.employeeId)) {
      cbByEmployee.set(entry.employeeId, []);
    }
    cbByEmployee.get(entry.employeeId)!.push(entry);
  });
  
  // Détecter les doublons
  const duplicateMap = detectDuplicates(coreBankingEntries, payPeriod);
  
  // Calculer les statistiques pour détection d'anomalies
  const allAmounts = sourceEntries.map(e => e.expectedAmount);
  const stats = detectAnomalies(allAmounts);
  
  // Traiter chaque entrée source
  sourceEntries.forEach(source => {
    const cbEntries = cbByEmployee.get(source.employeeId) || [];
    const totalReceived = cbEntries.reduce((sum, e) => sum + e.actualAmount, 0);
    const { delta, status } = calculateDelta(source.expectedAmount, cbEntries);
    
    // Vérifier si c'est une anomalie statistique
    const isAnomaly = Math.abs(source.expectedAmount - stats.mean) > stats.threshold;
    
    // Vérifier les doublons
    const isDuplicate = duplicateMap.has(`${source.employeeId}_${payPeriod}`);
    
    let resultStatus: ReconciliationResult['status'] = status;
    let flagged = false;
    let flagReason: string | undefined;
    
    if (cbEntries.length === 0) {
      resultStatus = 'MISSING';
      flagged = true;
      flagReason = 'Aucune transaction trouvée';
      
      corrections.push({
        employeeId: source.employeeId,
        name: source.name,
        rib: source.rib,
        missingAmount: source.expectedAmount,
        reason: 'Virement manquant'
      });
    } else if (isDuplicate) {
      resultStatus = 'DUPLICATE';
      flagged = true;
      flagReason = `${cbEntries.length} transactions détectées`;
      
      const excess = totalReceived - source.expectedAmount;
      if (excess > 0) {
        duplicates.push({
          employeeId: source.employeeId,
          name: source.name,
          rib: source.rib,
          transactions: cbEntries,
          totalPaid: totalReceived,
          expectedAmount: source.expectedAmount,
          excessAmount: excess
        });
        
        recoveries.push({
          employeeId: source.employeeId,
          name: source.name,
          rib: source.rib,
          excessAmount: excess,
          transactions: cbEntries,
          reason: 'Double paiement détecté'
        });
      }
    } else if (status === 'UNDERPAID') {
      corrections.push({
        employeeId: source.employeeId,
        name: source.name,
        rib: source.rib,
        missingAmount: delta,
        reason: 'Montant insuffisant'
      });
    } else if (status === 'OVERPAID') {
      recoveries.push({
        employeeId: source.employeeId,
        name: source.name,
        rib: source.rib,
        excessAmount: delta,
        transactions: cbEntries,
        reason: 'Trop-perçu'
      });
    }
    
    if (isAnomaly && !flagged) {
      flagged = true;
      flagReason = 'Montant hors norme statistique';
    }
    
    results.push({
      employeeId: source.employeeId,
      name: source.name,
      rib: source.rib,
      expectedAmount: source.expectedAmount,
      actualAmount: totalReceived,
      delta: source.expectedAmount - totalReceived,
      status: resultStatus,
      transactionCount: cbEntries.length,
      transactions: cbEntries,
      flagged,
      flagReason
    });
  });
  
  // Calculer les totaux
  const summary: ReconciliationSummary = {
    totalExpected: sourceEntries.reduce((sum, e) => sum + e.expectedAmount, 0),
    totalActual: coreBankingEntries.reduce((sum, e) => sum + e.actualAmount, 0),
    totalDelta: 0,
    matchCount: results.filter(r => r.status === 'MATCH').length,
    underpaidCount: results.filter(r => r.status === 'UNDERPAID').length,
    overpaidCount: results.filter(r => r.status === 'OVERPAID').length,
    missingCount: results.filter(r => r.status === 'MISSING').length,
    duplicateCount: duplicates.length,
    anomalyCount: results.filter(r => r.flagged).length,
    results,
    duplicates,
    corrections,
    recoveries
  };
  
  summary.totalDelta = summary.totalExpected - summary.totalActual;
  
  return summary;
}

/**
 * Correspondance floue (Levenshtein) pour les noms
 */
export function levenshteinDistance(a: string, b: string): number {
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

export function fuzzyMatchName(name1: string, name2: string): number {
  const normalized1 = name1.toLowerCase().trim().replace(/\s+/g, ' ');
  const normalized2 = name2.toLowerCase().trim().replace(/\s+/g, ' ');
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLen = Math.max(normalized1.length, normalized2.length);
  
  return maxLen > 0 ? ((maxLen - distance) / maxLen) * 100 : 100;
}
