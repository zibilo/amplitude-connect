/**
 * ISO 20022 XML Generator for Sopra Banking Amplitude
 * Generates pain.001.001.03 (CustomerCreditTransferInitiation) format
 * 
 * Supports:
 * - Dual PmtInf blocks: AVEC frais / SANS frais
 * - Invalid account redirection to technical account 38100000000
 * - XAF currency, UTF-8 encoding
 * - Rejection logging
 */

import { TripleCheckResult, PaymentLine } from './tripleCheckEngine';
import { FlatFileParseResult, FlatFileDetail } from './flatFileParser';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ISO20022Config {
  initiatingParty: string;
  debitAccount: string;
  debitAccountSansFrais?: string;
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
  nbPmtInf: number;
  rejections: XMLRejectionEntry[];
}

export interface XMLRejectionEntry {
  nom: string;
  ribOriginal: string;
  montant: number;
  reason: string;
  action: 'REDIRECTED' | 'EXCLUDED';
  redirectedTo?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${reference}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// ─── Credit Transfer Transaction Block ──────────────────────────────────────

function buildCdtTrfTxInf(
  endToEndId: string,
  amount: number,
  creditorName: string,
  creditorAccount: string,
  purposeCode: string,
  remittanceInfo: string,
): string {
  const codeBanque = creditorAccount.substring(0, 5);
  
  return `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="XAF">${formatAmount(amount)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <ClrSysMmbId>
              <MmbId>${escapeXml(codeBanque)}</MmbId>
            </ClrSysMmbId>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(creditorName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <Othr>
              <Id>${escapeXml(creditorAccount)}</Id>
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
          <Ustrd>${escapeXml(remittanceInfo)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
}

// ─── PmtInf Block Builder ───────────────────────────────────────────────────

function buildPmtInf(
  pmtInfId: string,
  debitAccount: string,
  debitBIC: string,
  initiatingParty: string,
  executionDate: string,
  batchBooking: boolean,
  categoryPurpose: string,
  transactions: string[],
  nbOfTxs: number,
  ctrlSum: number,
): string {
  return `    <PmtInf>
      <PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>${batchBooking ? 'true' : 'false'}</BtchBookg>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${formatAmount(ctrlSum)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>NURG</Cd>
        </SvcLvl>
        <CtgyPurp>
          <Cd>${categoryPurpose}</Cd>
        </CtgyPurp>
      </PmtTpInf>
      <ReqdExctnDt>${executionDate}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(initiatingParty)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>${escapeXml(debitAccount)}</Id>
            <SchmeNm>
              <Cd>BBAN</Cd>
            </SchmeNm>
          </Othr>
        </Id>
        <Ccy>XAF</Ccy>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${escapeXml(debitBIC)}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>DEBT</ChrgBr>
${transactions.join('\n')}
    </PmtInf>`;
}

// ─── Main Generator: From Flat File Parse Result ────────────────────────────

export function generateISO20022FromFlatFile(
  parseResult: FlatFileParseResult,
  config: ISO20022Config,
): GeneratedXMLResult {
  const now = new Date();
  const msgId = generateMsgId(config.reference);
  const rejections: XMLRejectionEntry[] = [];

  // Separate details: valid vs redirected
  const avecFraisDetails: FlatFileDetail[] = [];
  const sansFraisDetails: FlatFileDetail[] = [];

  // All details go to the appropriate PmtInf based on header's debit account
  const debitAvecFrais = config.debitAccount;
  const debitSansFrais = config.debitAccountSansFrais || config.debitAccount;

  for (const detail of parseResult.details) {
    if (detail.redirected) {
      rejections.push({
        nom: detail.nomComplet,
        ribOriginal: detail.ribOriginal || '',
        montant: detail.montant,
        reason: detail.invalidReason || 'Compte invalide',
        action: 'REDIRECTED',
        redirectedTo: detail.rib,
      });
    }

    // Route based on whether header indicates avec/sans frais
    if (parseResult.header.avecFrais) {
      avecFraisDetails.push(detail);
    } else {
      sansFraisDetails.push(detail);
    }
  }

  // Build transactions for each group
  let globalIndex = 0;
  const pmtInfBlocks: string[] = [];
  let totalTxs = 0;
  let totalAmount = 0;

  // PmtInf AVEC frais
  if (avecFraisDetails.length > 0) {
    const txs = avecFraisDetails.map((d, i) => {
      const endToEndId = `${config.reference}-AF-${(++globalIndex).toString().padStart(6, '0')}`;
      return buildCdtTrfTxInf(
        endToEndId, d.montant, d.nomComplet, d.rib,
        'SALA', d.libelle || `VIREMENT SALAIRE`
      );
    });
    const sum = avecFraisDetails.reduce((s, d) => s + d.montant, 0);
    pmtInfBlocks.push(buildPmtInf(
      `${config.reference}-AVEC-FRAIS`, debitAvecFrais, config.debitBIC,
      config.initiatingParty, config.executionDate, config.batchBooking,
      'SALA', txs, avecFraisDetails.length, sum
    ));
    totalTxs += avecFraisDetails.length;
    totalAmount += sum;
  }

  // PmtInf SANS frais
  if (sansFraisDetails.length > 0) {
    const txs = sansFraisDetails.map((d) => {
      const endToEndId = `${config.reference}-SF-${(++globalIndex).toString().padStart(6, '0')}`;
      return buildCdtTrfTxInf(
        endToEndId, d.montant, d.nomComplet, d.rib,
        'SALA', d.libelle || `VIREMENT SALAIRE`
      );
    });
    const sum = sansFraisDetails.reduce((s, d) => s + d.montant, 0);
    pmtInfBlocks.push(buildPmtInf(
      `${config.reference}-SANS-FRAIS`, debitSansFrais, config.debitBIC,
      config.initiatingParty, config.executionDate, config.batchBooking,
      'SALA', txs, sansFraisDetails.length, sum
    ));
    totalTxs += sansFraisDetails.length;
    totalAmount += sum;
  }

  // Add rejection log entries from parse
  for (const rej of parseResult.rejectionLog) {
    if (!rejections.find(r => r.ribOriginal === rej.ribOriginal && r.nom === rej.nomComplet)) {
      rejections.push({
        nom: rej.nomComplet,
        ribOriginal: rej.ribOriginal,
        montant: rej.montant,
        reason: rej.reason,
        action: rej.action === 'REDIRECTED' ? 'REDIRECTED' : 'EXCLUDED',
        redirectedTo: rej.redirectedTo,
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${now.toISOString()}</CreDtTm>
      <NbOfTxs>${totalTxs}</NbOfTxs>
      <CtrlSum>${formatAmount(totalAmount)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(config.initiatingParty)}</Nm>
      </InitgPty>
    </GrpHdr>
${pmtInfBlocks.join('\n')}
  </CstmrCdtTrfInitn>
</Document>`;

  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const fileName = `pain001_${config.reference}_${dateStr}.xml`;

  return {
    fileName,
    content: xml,
    totalTransactions: totalTxs,
    totalAmount,
    controlSum: totalAmount,
    generatedAt: now,
    nbPmtInf: pmtInfBlocks.length,
    rejections,
  };
}

// ─── Generator from Triple Check Results (existing flow) ────────────────────

export function generateISO20022XML(
  results: TripleCheckResult[],
  config: ISO20022Config,
): GeneratedXMLResult {
  const now = new Date();
  const msgId = generateMsgId(config.reference);
  const rejections: XMLRejectionEntry[] = [];

  // Flatten all payment lines from valid results
  const allLines: { result: TripleCheckResult; line: PaymentLine; index: number }[] = [];
  let globalIndex = 0;

  for (const result of results) {
    if (!result.balance_ok) continue;
    for (const line of result.lines) {
      allLines.push({ result, line, index: globalIndex++ });
    }
  }

  const totalAmount = allLines.reduce((sum, l) => sum + l.line.montant, 0);
  const nbOfTxs = allLines.length;

  const txElements = allLines.map(({ result, line, index }) => {
    let purposeCode = 'SALA';
    if (line.type === 'SAISIE_ARRET') purposeCode = 'GARN';
    else if (line.type === 'EPARGNE') purposeCode = 'SAVG';

    const endToEndId = `${config.reference}-${(index + 1).toString().padStart(6, '0')}`;
    return buildCdtTrfTxInf(
      endToEndId, line.montant, line.beneficiaire,
      line.rib_destination, purposeCode,
      line.motif || `VIREMENT SALAIRE ${result.matricule}`
    );
  });

  const pmtInf = buildPmtInf(
    config.reference, config.debitAccount, config.debitBIC,
    config.initiatingParty, config.executionDate, config.batchBooking,
    'SALA', txElements, nbOfTxs, totalAmount
  );

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
${pmtInf}
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
    nbPmtInf: 1,
    rejections,
  };
}

// ─── Amplitude MVTI Generator ───────────────────────────────────────────────

export function generateAmplitudeMVTI(
  results: TripleCheckResult[],
  config: ISO20022Config,
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

  const requestRows = allLines.map(({ result, line }) => {
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
    nbPmtInf: 1,
    rejections: [],
  };
}
