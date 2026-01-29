/**
 * Générateurs de fichiers de sortie pour la réconciliation
 * - RECOUVREMENT_DUPLICATA.xlsx
 * - COMPLEMENT_SALAIRE.xlsx  
 * - RAPPORT_AUDIT.pdf (JSON pour l'instant)
 */

import ExcelJS from 'exceljs';
import type { 
  ReconciliationSummary, 
  CorrectionEntry, 
  RecoveryEntry,
  ReconciliationResult 
} from './reconciliationEngine';

/**
 * Générer le fichier de compléments de salaire (UNDERPAID + MISSING)
 */
export async function generateComplementFile(
  corrections: CorrectionEntry[],
  companyName: string,
  period: string
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MUCO-AMPLITUDE Middleware';
  workbook.created = new Date();
  
  const sheet = workbook.addWorksheet('Compléments Salaire');
  
  // En-têtes avec style
  sheet.columns = [
    { header: 'ID Employé', key: 'employeeId', width: 15 },
    { header: 'Nom Complet', key: 'name', width: 30 },
    { header: 'RIB', key: 'rib', width: 25 },
    { header: 'Montant à Virer (FCFA)', key: 'missingAmount', width: 20 },
    { header: 'Motif', key: 'reason', width: 25 },
    { header: 'Référence', key: 'reference', width: 20 }
  ];
  
  // Style des en-têtes
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }
  };
  headerRow.alignment = { horizontal: 'center' };
  
  // Données
  let totalComplement = 0;
  corrections.forEach((correction, index) => {
    totalComplement += correction.missingAmount;
    sheet.addRow({
      employeeId: correction.employeeId,
      name: correction.name,
      rib: correction.rib,
      missingAmount: correction.missingAmount,
      reason: correction.reason,
      reference: `COMPL-${period}-${String(index + 1).padStart(4, '0')}`
    });
  });
  
  // Ligne de total
  const totalRow = sheet.addRow({
    employeeId: '',
    name: 'TOTAL',
    rib: '',
    missingAmount: totalComplement,
    reason: '',
    reference: ''
  });
  totalRow.font = { bold: true };
  totalRow.getCell('missingAmount').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF22C55E' }
  };
  
  // Format monétaire
  sheet.getColumn('missingAmount').numFmt = '#,##0 "FCFA"';
  
  // Métadonnées
  const metaSheet = workbook.addWorksheet('Métadonnées');
  metaSheet.addRow(['Entreprise', companyName]);
  metaSheet.addRow(['Période', period]);
  metaSheet.addRow(['Date de génération', new Date().toISOString()]);
  metaSheet.addRow(['Nombre d\'entrées', corrections.length]);
  metaSheet.addRow(['Montant total', totalComplement]);
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

/**
 * Générer le fichier de recouvrement (OVERPAID + DUPLICATES)
 */
export async function generateRecoveryFile(
  recoveries: RecoveryEntry[],
  companyName: string,
  period: string
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MUCO-AMPLITUDE Middleware';
  workbook.created = new Date();
  
  const sheet = workbook.addWorksheet('Recouvrements');
  
  sheet.columns = [
    { header: 'ID Employé', key: 'employeeId', width: 15 },
    { header: 'Nom Complet', key: 'name', width: 30 },
    { header: 'RIB', key: 'rib', width: 25 },
    { header: 'Excédent à Récupérer (FCFA)', key: 'excessAmount', width: 25 },
    { header: 'Nb Transactions', key: 'transactionCount', width: 15 },
    { header: 'Motif', key: 'reason', width: 25 },
    { header: 'Action Recommandée', key: 'action', width: 30 }
  ];
  
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDC2626' }
  };
  headerRow.alignment = { horizontal: 'center' };
  
  let totalRecovery = 0;
  recoveries.forEach(recovery => {
    totalRecovery += recovery.excessAmount;
    sheet.addRow({
      employeeId: recovery.employeeId,
      name: recovery.name,
      rib: recovery.rib,
      excessAmount: recovery.excessAmount,
      transactionCount: recovery.transactions.length,
      reason: recovery.reason,
      action: recovery.reason === 'Double paiement détecté' 
        ? 'Annulation du duplicata' 
        : 'Prélèvement sur prochain salaire'
    });
  });
  
  const totalRow = sheet.addRow({
    employeeId: '',
    name: 'TOTAL À RECOUVRER',
    rib: '',
    excessAmount: totalRecovery,
    transactionCount: '',
    reason: '',
    action: ''
  });
  totalRow.font = { bold: true };
  totalRow.getCell('excessAmount').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEF4444' }
  };
  
  sheet.getColumn('excessAmount').numFmt = '#,##0 "FCFA"';
  
  // Détails des transactions en doublon
  const detailSheet = workbook.addWorksheet('Détail Transactions');
  detailSheet.columns = [
    { header: 'ID Employé', key: 'employeeId', width: 15 },
    { header: 'ID Transaction', key: 'transactionId', width: 20 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Montant', key: 'amount', width: 15 },
    { header: 'Statut', key: 'status', width: 15 }
  ];
  
  recoveries.forEach(recovery => {
    recovery.transactions.forEach(tx => {
      detailSheet.addRow({
        employeeId: recovery.employeeId,
        transactionId: tx.transactionId,
        date: tx.transactionDate,
        amount: tx.actualAmount,
        status: tx.status
      });
    });
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

/**
 * Générer le rapport d'audit complet
 */
export async function generateAuditReport(
  summary: ReconciliationSummary,
  companyName: string,
  period: string
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MUCO-AMPLITUDE Middleware';
  workbook.created = new Date();
  
  // Feuille Résumé
  const summarySheet = workbook.addWorksheet('Résumé');
  summarySheet.columns = [
    { header: 'Indicateur', key: 'indicator', width: 30 },
    { header: 'Valeur', key: 'value', width: 25 }
  ];
  
  const summaryData = [
    ['Entreprise', companyName],
    ['Période', period],
    ['Date du rapport', new Date().toLocaleString('fr-FR')],
    ['', ''],
    ['TOTAUX', ''],
    ['Montant attendu', formatAmount(summary.totalExpected)],
    ['Montant reçu', formatAmount(summary.totalActual)],
    ['Écart total', formatAmount(summary.totalDelta)],
    ['', ''],
    ['STATISTIQUES', ''],
    ['Correspondances exactes', summary.matchCount],
    ['Sous-paiements', summary.underpaidCount],
    ['Sur-paiements', summary.overpaidCount],
    ['Manquants', summary.missingCount],
    ['Doublons détectés', summary.duplicateCount],
    ['Anomalies signalées', summary.anomalyCount],
    ['', ''],
    ['ACTIONS REQUISES', ''],
    ['Virements complémentaires', summary.corrections.length],
    ['Recouvrements à effectuer', summary.recoveries.length]
  ];
  
  summaryData.forEach(([indicator, value]) => {
    const row = summarySheet.addRow({ indicator, value });
    if (indicator === 'TOTAUX' || indicator === 'STATISTIQUES' || indicator === 'ACTIONS REQUISES') {
      row.font = { bold: true };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
      };
    }
  });
  
  // Feuille Détail complet
  const detailSheet = workbook.addWorksheet('Détail Réconciliation');
  detailSheet.columns = [
    { header: 'ID', key: 'employeeId', width: 12 },
    { header: 'Nom', key: 'name', width: 25 },
    { header: 'RIB', key: 'rib', width: 25 },
    { header: 'Attendu', key: 'expected', width: 15 },
    { header: 'Reçu', key: 'actual', width: 15 },
    { header: 'Écart', key: 'delta', width: 15 },
    { header: 'Statut', key: 'status', width: 12 },
    { header: 'Nb Tx', key: 'txCount', width: 8 },
    { header: 'Alerte', key: 'flagged', width: 8 },
    { header: 'Motif Alerte', key: 'flagReason', width: 25 }
  ];
  
  const headerRow = detailSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF374151' }
  };
  
  summary.results.forEach(result => {
    const row = detailSheet.addRow({
      employeeId: result.employeeId,
      name: result.name,
      rib: result.rib,
      expected: result.expectedAmount,
      actual: result.actualAmount,
      delta: result.delta,
      status: result.status,
      txCount: result.transactionCount,
      flagged: result.flagged ? 'OUI' : '',
      flagReason: result.flagReason || ''
    });
    
    // Coloration conditionnelle
    const deltaCell = row.getCell('delta');
    if (result.delta > 0) {
      deltaCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' } // Jaune clair
      };
    } else if (result.delta < 0) {
      deltaCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' } // Rouge clair
      };
    } else {
      deltaCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1FAE5' } // Vert clair
      };
    }
    
    const statusCell = row.getCell('status');
    const statusColors: Record<string, string> = {
      'MATCH': 'FF22C55E',
      'UNDERPAID': 'FFFBBF24',
      'OVERPAID': 'FFEF4444',
      'MISSING': 'FF9333EA',
      'DUPLICATE': 'FFDC2626'
    };
    statusCell.font = { 
      bold: true, 
      color: { argb: 'FFFFFFFF' } 
    };
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: statusColors[result.status] || 'FF6B7280' }
    };
  });
  
  // Format monétaire
  ['expected', 'actual', 'delta'].forEach(col => {
    detailSheet.getColumn(col).numFmt = '#,##0 "FCFA"';
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * Parser un fichier Excel source (Référentiel RH)
 */
export async function parseSourceExcel(file: File): Promise<{
  entries: Array<{
    id: string;
    employeeId: string;
    name: string;
    rib: string;
    expectedAmount: number;
    payDate: string;
  }>;
  errors: string[];
}> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const sheet = workbook.worksheets[0];
  const entries: Array<{
    id: string;
    employeeId: string;
    name: string;
    rib: string;
    expectedAmount: number;
    payDate: string;
  }> = [];
  const errors: string[] = [];
  
  // Trouver les colonnes par en-tête
  const headerRow = sheet.getRow(1);
  const columns: Record<string, number> = {};
  
  headerRow.eachCell((cell, colNumber) => {
    const value = String(cell.value || '').toLowerCase().trim();
    if (value.includes('matricule') || value.includes('id')) {
      columns.employeeId = colNumber;
    } else if (value.includes('nom') || value.includes('name')) {
      columns.name = colNumber;
    } else if (value.includes('rib') || value.includes('compte')) {
      columns.rib = colNumber;
    } else if (value.includes('montant') || value.includes('salaire') || value.includes('amount')) {
      columns.amount = colNumber;
    } else if (value.includes('date')) {
      columns.date = colNumber;
    }
  });
  
  if (!columns.employeeId || !columns.amount) {
    errors.push('Colonnes obligatoires manquantes: Matricule et Montant');
    return { entries, errors };
  }
  
  // Parser les lignes
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    const employeeId = String(row.getCell(columns.employeeId).value || '').trim();
    const name = columns.name ? String(row.getCell(columns.name).value || '').trim() : '';
    const rib = columns.rib ? String(row.getCell(columns.rib).value || '').trim() : '';
    const amountRaw = row.getCell(columns.amount).value;
    const dateRaw = columns.date ? row.getCell(columns.date).value : new Date();
    
    if (!employeeId) return;
    
    const amount = typeof amountRaw === 'number' 
      ? amountRaw 
      : parseFloat(String(amountRaw).replace(/[^\d.-]/g, ''));
    
    if (isNaN(amount)) {
      errors.push(`Ligne ${rowNumber}: Montant invalide`);
      return;
    }
    
    entries.push({
      id: `SRC-${rowNumber}`,
      employeeId,
      name,
      rib,
      expectedAmount: amount,
      payDate: dateRaw instanceof Date 
        ? dateRaw.toISOString().split('T')[0]
        : String(dateRaw)
    });
  });
  
  return { entries, errors };
}

/**
 * Parser un fichier Core Banking (CSV/Excel)
 */
export async function parseCoreBankingFile(file: File): Promise<{
  entries: Array<{
    id: string;
    employeeId: string;
    name: string;
    rib: string;
    actualAmount: number;
    transactionDate: string;
    transactionId: string;
    status: 'EXECUTED' | 'PENDING' | 'REJECTED';
  }>;
  errors: string[];
}> {
  const entries: Array<{
    id: string;
    employeeId: string;
    name: string;
    rib: string;
    actualAmount: number;
    transactionDate: string;
    transactionId: string;
    status: 'EXECUTED' | 'PENDING' | 'REJECTED';
  }> = [];
  const errors: string[] = [];
  
  if (file.name.endsWith('.csv')) {
    // Parser CSV
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    
    if (lines.length < 2) {
      errors.push('Fichier CSV vide ou sans données');
      return { entries, errors };
    }
    
    const headers = lines[0].split(/[,;]/).map(h => h.toLowerCase().trim());
    
    lines.slice(1).forEach((line, idx) => {
      const values = line.split(/[,;]/);
      
      const employeeId = values[headers.findIndex(h => h.includes('matricule') || h.includes('id'))] || '';
      const name = values[headers.findIndex(h => h.includes('nom'))] || '';
      const rib = values[headers.findIndex(h => h.includes('rib'))] || '';
      const amountStr = values[headers.findIndex(h => h.includes('montant') || h.includes('amount'))] || '0';
      const dateStr = values[headers.findIndex(h => h.includes('date'))] || '';
      const txId = values[headers.findIndex(h => h.includes('transaction') || h.includes('ref'))] || `TX-${idx}`;
      const statusStr = values[headers.findIndex(h => h.includes('statut') || h.includes('status'))] || 'EXECUTED';
      
      const amount = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
      
      if (employeeId && !isNaN(amount)) {
        entries.push({
          id: `CB-${idx}`,
          employeeId: employeeId.trim(),
          name: name.trim(),
          rib: rib.trim(),
          actualAmount: amount,
          transactionDate: dateStr.trim(),
          transactionId: txId.trim(),
          status: (['EXECUTED', 'PENDING', 'REJECTED'].includes(statusStr.toUpperCase()) 
            ? statusStr.toUpperCase() 
            : 'EXECUTED') as 'EXECUTED' | 'PENDING' | 'REJECTED'
        });
      }
    });
  } else {
    // Parser Excel
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1);
    const columns: Record<string, number> = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const value = String(cell.value || '').toLowerCase().trim();
      if (value.includes('matricule') || value.includes('id')) columns.employeeId = colNumber;
      if (value.includes('nom')) columns.name = colNumber;
      if (value.includes('rib')) columns.rib = colNumber;
      if (value.includes('montant') || value.includes('amount')) columns.amount = colNumber;
      if (value.includes('date')) columns.date = colNumber;
      if (value.includes('transaction') || value.includes('ref')) columns.txId = colNumber;
      if (value.includes('statut') || value.includes('status')) columns.status = colNumber;
    });
    
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      
      const employeeId = columns.employeeId ? String(row.getCell(columns.employeeId).value || '').trim() : '';
      const name = columns.name ? String(row.getCell(columns.name).value || '').trim() : '';
      const rib = columns.rib ? String(row.getCell(columns.rib).value || '').trim() : '';
      const amountRaw = columns.amount ? row.getCell(columns.amount).value : 0;
      const dateRaw = columns.date ? row.getCell(columns.date).value : new Date();
      const txId = columns.txId ? String(row.getCell(columns.txId).value || `TX-${rowNumber}`).trim() : `TX-${rowNumber}`;
      const statusRaw = columns.status ? String(row.getCell(columns.status).value || 'EXECUTED').toUpperCase() : 'EXECUTED';
      
      const amount = typeof amountRaw === 'number' 
        ? amountRaw 
        : parseFloat(String(amountRaw).replace(/[^\d.-]/g, ''));
      
      if (employeeId && !isNaN(amount)) {
        entries.push({
          id: `CB-${rowNumber}`,
          employeeId,
          name,
          rib,
          actualAmount: amount,
          transactionDate: dateRaw instanceof Date 
            ? dateRaw.toISOString().split('T')[0]
            : String(dateRaw),
          transactionId: txId,
          status: (['EXECUTED', 'PENDING', 'REJECTED'].includes(statusRaw) 
            ? statusRaw 
            : 'EXECUTED') as 'EXECUTED' | 'PENDING' | 'REJECTED'
        });
      }
    });
  }
  
  return { entries, errors };
}
