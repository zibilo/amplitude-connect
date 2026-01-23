import * as XLSX from 'xlsx';
import { PayrollEntry, ImportResult } from '@/types/payroll';
import { validateRIB } from './ribValidation';

/**
 * Parse an Excel file containing payroll data
 * Expected columns: Matricule, Nom, Prénom, RIB, Montant
 */
export async function parsePayrollExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
        
        if (jsonData.length === 0) {
          reject(new Error('Le fichier Excel est vide'));
          return;
        }
        
        const entries: PayrollEntry[] = [];
        let totalValid = 0;
        let totalInvalid = 0;
        let totalAmount = 0;
        
        jsonData.forEach((row, index) => {
          // Map column names (flexible matching)
          const matricule = String(findColumn(row, ['matricule', 'mat', 'id', 'numero']) || '');
          const nom = String(findColumn(row, ['nom', 'name', 'lastname']) || '');
          const prenom = String(findColumn(row, ['prenom', 'prénom', 'firstname']) || '');
          const rib = String(findColumn(row, ['rib', 'compte', 'account', 'iban']) || '');
          const montantRaw = findColumn(row, ['montant', 'amount', 'salaire', 'salary', 'somme']);
          
          // Parse amount
          let montant = 0;
          if (typeof montantRaw === 'number') {
            montant = montantRaw;
          } else if (typeof montantRaw === 'string') {
            // Remove currency symbols and spaces, handle French decimal format
            montant = parseFloat(montantRaw.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          }
          
          // Validate RIB
          const ribValidation = validateRIB(rib);
          
          const entry: PayrollEntry = {
            id: `entry-${index + 1}-${Date.now()}`,
            matricule: matricule.trim(),
            nom: nom.trim().toUpperCase(),
            prenom: prenom.trim(),
            rib: rib.replace(/[\s.-]/g, '').toUpperCase(),
            montant,
            ribValid: ribValidation.valid,
            ribError: ribValidation.error,
            status: ribValidation.valid ? 'valid' : 'invalid'
          };
          
          entries.push(entry);
          
          if (ribValidation.valid) {
            totalValid++;
            totalAmount += montant;
          } else {
            totalInvalid++;
          }
        });
        
        resolve({
          entries,
          totalValid,
          totalInvalid,
          totalAmount,
          importDate: new Date(),
          fileName: file.name
        });
        
      } catch (error) {
        reject(new Error(`Erreur lors de l'analyse du fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erreur de lecture du fichier'));
    };
    
    reader.readAsBinaryString(file);
  });
}

/**
 * Find a column value by trying multiple possible column names
 */
function findColumn(row: Record<string, unknown>, possibleNames: string[]): unknown {
  for (const name of possibleNames) {
    // Try exact match (case-insensitive)
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === name.toLowerCase()) {
        return row[key];
      }
    }
    // Try partial match
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes(name.toLowerCase())) {
        return row[key];
      }
    }
  }
  return undefined;
}

/**
 * Generate a sample Excel template for download
 */
export function generateSampleTemplate(): Blob {
  const sampleData = [
    { Matricule: '001', Nom: 'DUPONT', Prénom: 'Jean', RIB: '30001 00794 12345678901 85', Montant: 2500.00 },
    { Matricule: '002', Nom: 'MARTIN', Prénom: 'Marie', RIB: '30002 00564 98765432109 42', Montant: 3200.50 },
    { Matricule: '003', Nom: 'DURAND', Prénom: 'Pierre', RIB: '30003 00123 11111111111 06', Montant: 1850.75 },
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Paie');
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Matricule
    { wch: 20 }, // Nom
    { wch: 15 }, // Prénom
    { wch: 30 }, // RIB
    { wch: 15 }, // Montant
  ];
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
