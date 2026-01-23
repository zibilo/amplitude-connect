import { PayrollEntry, GeneratedFile } from '@/types/payroll';
import { formatRIB } from './ribValidation';

/**
 * Generate XML file in MVTI_008 format for Sopra Banking Amplitude
 * Encoding: UTF-16 Unicode as per specification
 */
export function generateMVTI008XML(entries: PayrollEntry[], reference: string): GeneratedFile {
  const validEntries = entries.filter(e => e.status === 'valid');
  const totalAmount = validEntries.reduce((sum, e) => sum + e.montant, 0);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  
  // Build XML structure according to MVTI_008 specification
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<MVTI_008>
  <Header>
    <Reference>${reference}</Reference>
    <DateCreation>${dateStr}</DateCreation>
    <HeureCreation>${timeStr}</HeureCreation>
    <NombreOperations>${validEntries.length}</NombreOperations>
    <MontantTotal>${totalAmount.toFixed(2)}</MontantTotal>
    <TypeOperation>VIREMENT_SALAIRE</TypeOperation>
    <CodeDevise>XAF</CodeDevise>
  </Header>
  <Operations>
${validEntries.map((entry, index) => `    <Operation>
      <NumeroSequence>${(index + 1).toString().padStart(6, '0')}</NumeroSequence>
      <Matricule>${escapeXml(entry.matricule)}</Matricule>
      <Beneficiaire>
        <Nom>${escapeXml(entry.nom)}</Nom>
        <Prenom>${escapeXml(entry.prenom)}</Prenom>
      </Beneficiaire>
      <CompteBeneficiaire>
        <RIB>${entry.rib}</RIB>
        <CodeBanque>${entry.rib.substring(0, 5)}</CodeBanque>
        <CodeGuichet>${entry.rib.substring(5, 10)}</CodeGuichet>
        <NumeroCompte>${entry.rib.substring(10, 21)}</NumeroCompte>
        <CleRIB>${entry.rib.substring(21, 23)}</CleRIB>
      </CompteBeneficiaire>
      <Montant>${entry.montant.toFixed(2)}</Montant>
      <Motif>VIREMENT SALAIRE ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()}</Motif>
    </Operation>`).join('\n')}
  </Operations>
  <Footer>
    <Checksum>${calculateChecksum(validEntries)}</Checksum>
  </Footer>
</MVTI_008>`;

  const fileName = `MVTI_008_${reference}_${dateStr}.xml`;
  
  return {
    id: `gen-${Date.now()}`,
    type: 'xml',
    format: 'MVTI_008',
    fileName,
    content: xml,
    generatedAt: now,
    entriesCount: validEntries.length,
    totalAmount
  };
}

/**
 * Generate flat file in INT-VIRMU2 format (255 characters per line, fixed positions)
 * As per MUCODEC specification
 */
export function generateINTVIRMU2Flat(entries: PayrollEntry[], reference: string): GeneratedFile {
  const validEntries = entries.filter(e => e.status === 'valid');
  const totalAmount = validEntries.reduce((sum, e) => sum + e.montant, 0);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  
  const lines: string[] = [];
  
  // Header record (Type 01)
  const header = buildFixedLine({
    '1-2': '01',                                    // Type enregistrement
    '3-10': dateStr,                                // Date création (AAAAMMJJ)
    '11-20': reference.padEnd(10),                  // Référence fichier
    '21-28': validEntries.length.toString().padStart(8, '0'), // Nombre opérations
    '29-43': Math.round(totalAmount * 100).toString().padStart(15, '0'), // Montant total en centimes
    '44-46': 'XAF',                                 // Code devise
    '47-96': 'VIREMENT DE SALAIRES'.padEnd(50),     // Libellé
    '97-255': ''.padEnd(159)                        // Réservé
  });
  lines.push(header);
  
  // Detail records (Type 02)
  validEntries.forEach((entry, index) => {
    const nomComplet = `${entry.nom} ${entry.prenom}`.substring(0, 36);
    
    const detail = buildFixedLine({
      '1-2': '02',                                    // Type enregistrement
      '3-8': (index + 1).toString().padStart(6, '0'), // Numéro séquence
      '9-18': entry.matricule.padEnd(10),             // Matricule
      '19-54': nomComplet.padEnd(36),                 // Nom bénéficiaire (pos 14-49 in spec = 36 chars)
      '55-77': entry.rib.padEnd(23),                  // RIB (pos 74-101 in spec = 28 chars, but RIB is 23)
      '78-92': Math.round(entry.montant * 100).toString().padStart(15, '0'), // Montant en centimes
      '93-142': `SALAIRE ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()}`.padEnd(50).substring(0, 50), // Motif
      '143-255': ''.padEnd(113)                       // Réservé
    });
    lines.push(detail);
  });
  
  // Footer record (Type 99)
  const footer = buildFixedLine({
    '1-2': '99',                                    // Type enregistrement
    '3-10': validEntries.length.toString().padStart(8, '0'), // Nombre opérations
    '11-25': Math.round(totalAmount * 100).toString().padStart(15, '0'), // Montant total
    '26-255': ''.padEnd(230)                        // Réservé
  });
  lines.push(footer);
  
  const content = lines.join('\r\n');
  const fileName = `INT-VIRMU2_${reference}_${dateStr}.txt`;
  
  return {
    id: `gen-${Date.now()}`,
    type: 'flat',
    format: 'INT-VIRMU2',
    fileName,
    content,
    generatedAt: now,
    entriesCount: validEntries.length,
    totalAmount
  };
}

/**
 * Build a fixed-length line from position specifications
 */
function buildFixedLine(positions: Record<string, string>): string {
  const line = new Array(255).fill(' ');
  
  for (const [range, value] of Object.entries(positions)) {
    const [start, end] = range.split('-').map(Number);
    const chars = value.split('');
    
    for (let i = 0; i < (end - start + 1) && i < chars.length; i++) {
      line[start - 1 + i] = chars[i];
    }
  }
  
  return line.join('');
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculate a simple checksum for validation
 */
function calculateChecksum(entries: PayrollEntry[]): string {
  const sum = entries.reduce((acc, entry) => {
    return acc + entry.montant + parseInt(entry.rib.substring(0, 5) || '0', 10);
  }, 0);
  return Math.abs(sum % 999999).toString().padStart(6, '0');
}

/**
 * Download a generated file
 */
export function downloadGeneratedFile(file: GeneratedFile): void {
  const blob = new Blob([file.content], { 
    type: file.type === 'xml' ? 'application/xml;charset=utf-16' : 'text/plain;charset=utf-8' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
