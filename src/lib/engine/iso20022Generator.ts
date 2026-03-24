/**
 * ISO 20022 XML Generator for Sopra Banking Amplitude
 * Generates pain.001.001.03 (CustomerCreditTransferInitiation) format
 */

import { TripleCheckResult, PaymentLine } from './tripleCheckEngine';

export interface ISO20022Config {
  initiatingParty: string;
  debitAccount: string;
  debitBIC: string;
  reference: string;
  executionDate: string;
  batchBooking: boolean;
}

export interface GeneratedXMLResult {
  fileName: string;
  content: string;
  totalTransactions: number;
  totalAmount: number;
  controlSum: number;
  generatedAt: Date;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function generateMsgId(reference: string): string {
  const now = new Date();
  return `${reference}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}`;
}

export function generateISO20022XML(
  results: TripleCheckResult[],
  config: ISO20022Config
): GeneratedXMLResult {
  const now = new Date();
  const msgId = generateMsgId(config.reference);
  
  // Flatten all payment lines from all results
  const allLines: { result: TripleCheckResult; line: PaymentLine; index: number }[] = [];
  let globalIndex = 0;
  
  for (const result of results) {
    if (!result.balance_ok) continue; // Skip entries with balance errors
    for (const line of result.lines) {
      allLines.push({ result, line, index: globalIndex++ });
    }
  }

  const totalAmount = allLines.reduce((sum, l) => sum + l.line.montant, 0);
  const nbOfTxs = allLines.length;

  const txElements = allLines.map(({ result, line, index }) => {
    // Determine purpose code based on line type
    let purposeCode = 'SALA'; // Salary
    let categoryPurpose = 'SALA';
    if (line.type === 'SAISIE_ARRET') {
      purposeCode = 'GARN'; // Garnishment
      categoryPurpose = 'SALA';
    } else if (line.type === 'EPARGNE') {
      purposeCode = 'SAVG'; // Savings
      categoryPurpose = 'SALA';
    }

    const endToEndId = `${config.reference}-${(index + 1).toString().padStart(6, '0')}`;
    
    // Extract RIB components
    const rib = line.rib_destination;
    const codeBanque = rib.substring(0, 5);
    const codeGuichet = rib.substring(5, 10);
    const numCompte = rib.substring(10, 21);
    const cleRib = rib.substring(21, 23);

    return `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="XAF">${formatAmount(line.montant)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <ClrSysMmbId>
              <MmbId>${escapeXml(codeBanque)}</MmbId>
            </ClrSysMmbId>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(line.beneficiaire)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <Othr>
              <Id>${escapeXml(rib)}</Id>
              <SchmeNm>
                <Cd>BBAN</Cd>
              </SchmeNm>
            </Othr>
          </Id>
        </CdtrAcct>
        <Purp>
          <Cd>${purposeCode}</Cd>
        </Purp>
        <RmtInf>
          <Ustrd>${escapeXml(line.motif || `VIREMENT SALAIRE ${result.matricule}`)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${now.toISOString()}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${formatAmount(totalAmount)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(config.initiatingParty)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(config.reference)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>${config.batchBooking ? 'true' : 'false'}</BtchBookg>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${formatAmount(totalAmount)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>NURG</Cd>
        </SvcLvl>
        <CtgyPurp>
          <Cd>SALA</Cd>
        </CtgyPurp>
      </PmtTpInf>
      <ReqdExctnDt>${config.executionDate}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(config.initiatingParty)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>${escapeXml(config.debitAccount)}</Id>
            <SchmeNm>
              <Cd>BBAN</Cd>
            </SchmeNm>
          </Othr>
        </Id>
        <Ccy>XAF</Ccy>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${escapeXml(config.debitBIC)}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>DEBT</ChrgBr>
${txElements}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const fileName = `pain001_${config.reference}_${dateStr}.xml`;

  return {
    fileName,
    content: xml,
    totalTransactions: nbOfTxs,
    totalAmount,
    controlSum: totalAmount,
    generatedAt: now,
  };
}

/**
 * Generate Amplitude MVTI XML from Triple Check results
 * Includes Branch, AccountId, Amount, Side, ReconciliationAccount
 */
export function generateAmplitudeMVTI(
  results: TripleCheckResult[],
  config: ISO20022Config
): GeneratedXMLResult {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');

  const allLines: { result: TripleCheckResult; line: PaymentLine; index: number }[] = [];
  let globalIndex = 0;
  for (const result of results) {
    if (!result.balance_ok) continue;
    for (const line of result.lines) {
      allLines.push({ result, line, index: globalIndex++ });
    }
  }

  const totalAmount = allLines.reduce((sum, l) => sum + l.line.montant, 0);

  const requestRows = allLines.map(({ result, line, index }) => {
    const rib = line.rib_destination;
    const branch = rib.substring(5, 10);
    const amountCents = Math.round(line.montant * 100);
    
    let entryType = 'SALARY_COURANT';
    if (line.type === 'SAISIE_ARRET') entryType = 'GARNISHMENT';
    else if (line.type === 'EPARGNE') entryType = 'SAVINGS';

    return `    <RequestRow>
      <Branch>${escapeXml(branch)}</Branch>
      <AccountId>${escapeXml(rib)}</AccountId>
      <Amount>${amountCents}</Amount>
      <Side>C</Side>
      <EntryType>${entryType}</EntryType>
      <Matricule>${escapeXml(result.matricule)}</Matricule>
      <Beneficiaire>${escapeXml(line.beneficiaire)}</Beneficiaire>
      <ReconciliationAccount>${escapeXml(line.reference || '')}</ReconciliationAccount>
      <Motif>${escapeXml(line.motif || `SALAIRE ${result.nom}`)}</Motif>
    </RequestRow>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<MVTI_008>
  <Header>
    <Reference>${escapeXml(config.reference)}</Reference>
    <DateCreation>${dateStr}</DateCreation>
    <HeureCreation>${timeStr}</HeureCreation>
    <NombreOperations>${allLines.length}</NombreOperations>
    <MontantTotal>${formatAmount(totalAmount)}</MontantTotal>
    <TypeOperation>VIREMENT_SALAIRE</TypeOperation>
    <CodeDevise>XAF</CodeDevise>
    <InitiatingParty>${escapeXml(config.initiatingParty)}</InitiatingParty>
  </Header>
  <Operations>
${requestRows}
  </Operations>
  <Footer>
    <ControlSum>${formatAmount(totalAmount)}</ControlSum>
    <NbOfTxs>${allLines.length}</NbOfTxs>
  </Footer>
</MVTI_008>`;

  const fileName = `MVTI_008_${config.reference}_${dateStr}.xml`;

  return {
    fileName,
    content: xml,
    totalTransactions: allLines.length,
    totalAmount,
    controlSum: totalAmount,
    generatedAt: now,
  };
}
