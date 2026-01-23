import { ReconciliationEntry, ReconciliationReport, PayrollEntry } from '@/types/payroll';

/**
 * Error codes from compensation reports
 */
const REJECTION_CODES: Record<string, string> = {
  '01': 'Compte clôturé',
  '02': 'Compte inexistant',
  '03': 'RIB invalide',
  '04': 'Provision insuffisante',
  '05': 'Compte bloqué',
  '06': 'Bénéficiaire inconnu',
  '07': 'Doublon détecté',
  '08': 'Montant incorrect',
  '09': 'Format de fichier invalide',
  '10': 'Erreur technique',
  '99': 'Autre motif'
};

/**
 * Parse a .RCP reconciliation file
 * Format: Fixed-width file with compensation results
 */
export async function parseRCPFile(file: File): Promise<ReconciliationReport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
          reject(new Error('Le fichier .RCP est vide'));
          return;
        }
        
        const entries: ReconciliationEntry[] = [];
        let totalEnvoye = 0;
        let totalRecu = 0;
        let totalRejete = 0;
        
        for (const line of lines) {
          // Skip header and footer lines
          const recordType = line.substring(0, 2);
          
          if (recordType === '02') {
            // Detail record
            const entry = parseRCPDetailLine(line);
            entries.push(entry);
            
            totalEnvoye += entry.montantEnvoye;
            if (entry.status === 'success') {
              totalRecu += entry.montantRecu || entry.montantEnvoye;
            } else if (entry.status === 'rejected') {
              totalRejete += entry.montantEnvoye;
            }
          }
        }
        
        const tauxSucces = totalEnvoye > 0 
          ? ((totalRecu / totalEnvoye) * 100) 
          : 0;
        
        resolve({
          id: `rcp-${Date.now()}`,
          fileName: file.name,
          importDate: new Date(),
          entries,
          totalEnvoye,
          totalRecu,
          totalRejete,
          tauxSucces
        });
        
      } catch (error) {
        reject(new Error(`Erreur lors de l'analyse du fichier RCP: ${error instanceof Error ? error.message : 'Erreur inconnue'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erreur de lecture du fichier'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Parse a single detail line from RCP file
 */
function parseRCPDetailLine(line: string): ReconciliationEntry {
  // Ensure line is long enough
  const paddedLine = line.padEnd(150);
  
  const rib = paddedLine.substring(10, 33).trim();
  const nom = paddedLine.substring(33, 69).trim();
  const montantStr = paddedLine.substring(69, 84).trim();
  const statusCode = paddedLine.substring(84, 86).trim();
  const rejectCode = paddedLine.substring(86, 88).trim();
  
  const montantEnvoye = parseInt(montantStr, 10) / 100; // Convert from centimes
  
  let status: 'success' | 'rejected' | 'pending' = 'pending';
  let motifRejet: string | undefined;
  
  if (statusCode === '00' || statusCode === 'OK') {
    status = 'success';
  } else if (statusCode === 'KO' || statusCode === 'RE') {
    status = 'rejected';
    motifRejet = REJECTION_CODES[rejectCode] || `Code erreur: ${rejectCode}`;
  }
  
  return {
    id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    rib,
    nom,
    montantEnvoye,
    montantRecu: status === 'success' ? montantEnvoye : undefined,
    status,
    motifRejet,
    dateCompensation: new Date()
  };
}

/**
 * Compare original payroll entries with reconciliation report
 */
export function compareWithOriginal(
  original: PayrollEntry[],
  reconciliation: ReconciliationReport
): {
  matched: Array<{ original: PayrollEntry; reconciled: ReconciliationEntry }>;
  unmatched: PayrollEntry[];
  extra: ReconciliationEntry[];
  summary: {
    matchRate: number;
    successRate: number;
    rejectionRate: number;
  };
} {
  const matched: Array<{ original: PayrollEntry; reconciled: ReconciliationEntry }> = [];
  const unmatched: PayrollEntry[] = [];
  const usedReconciliationIds = new Set<string>();
  
  // Match by RIB
  for (const origEntry of original) {
    const match = reconciliation.entries.find(
      recEntry => recEntry.rib === origEntry.rib && !usedReconciliationIds.has(recEntry.id)
    );
    
    if (match) {
      matched.push({ original: origEntry, reconciled: match });
      usedReconciliationIds.add(match.id);
    } else {
      unmatched.push(origEntry);
    }
  }
  
  // Find extra entries in reconciliation that weren't in original
  const extra = reconciliation.entries.filter(
    recEntry => !usedReconciliationIds.has(recEntry.id)
  );
  
  const successCount = matched.filter(m => m.reconciled.status === 'success').length;
  const rejectedCount = matched.filter(m => m.reconciled.status === 'rejected').length;
  
  return {
    matched,
    unmatched,
    extra,
    summary: {
      matchRate: original.length > 0 ? (matched.length / original.length) * 100 : 0,
      successRate: matched.length > 0 ? (successCount / matched.length) * 100 : 0,
      rejectionRate: matched.length > 0 ? (rejectedCount / matched.length) * 100 : 0
    }
  };
}

/**
 * Generate sample RCP file for testing
 */
export function generateSampleRCPFile(entries: PayrollEntry[]): Blob {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  
  // Header
  lines.push(`01${dateStr}${'COMPENSATION'.padEnd(20)}${entries.length.toString().padStart(8, '0')}`);
  
  // Details - simulate some successes and rejections
  entries.forEach((entry, index) => {
    const isSuccess = Math.random() > 0.15; // 85% success rate
    const statusCode = isSuccess ? '00' : 'KO';
    const rejectCode = isSuccess ? '  ' : ['01', '02', '04', '05'][Math.floor(Math.random() * 4)];
    
    const line = `02${(index + 1).toString().padStart(8, '0')}${entry.rib.padEnd(23)}${(entry.nom + ' ' + entry.prenom).padEnd(36).substring(0, 36)}${Math.round(entry.montant * 100).toString().padStart(15, '0')}${statusCode}${rejectCode}`;
    lines.push(line.padEnd(150));
  });
  
  // Footer
  const total = entries.reduce((sum, e) => sum + e.montant, 0);
  lines.push(`99${entries.length.toString().padStart(8, '0')}${Math.round(total * 100).toString().padStart(15, '0')}`);
  
  return new Blob([lines.join('\r\n')], { type: 'text/plain' });
}
