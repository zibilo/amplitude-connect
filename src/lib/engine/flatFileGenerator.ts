// flatFileGenerator.ts — génération du fichier plat MUCODEC (INT-VIRMU2)
// Correction: pour SAISIE_JURIDIQUE / SAISIE_AVAL, on inscrit toujours le RIB
// du bénéficiaire (créancier / organisme) et non celui du débiteur.

export interface FlatFileSplit {
  rib: string;
  montant: number;
  cleRib?: string;
  libelle?: string;
  isJudiciaire?: boolean;
  beneficiaireRib?: string;
  beneficiaireCle?: string;
  beneficiaireNom?: string;
  isAval?: boolean;
  referenceJuridique?: string;
}

export interface FlatFileRow {
  nom_complet: string;
  rib: string;
  montant: number;
  cleRib?: string;
  splits?: FlatFileSplit[];
  isJudiciaire?: boolean;
  isAval?: boolean;
  beneficiaireRib?: string;
  beneficiaireCle?: string;
  beneficiaireNom?: string;
  referenceJuridique?: string;
}

export interface FlatFileDetail {
  nom_complet: string;
  rib: string;
  montant: number;
  type: 'SALAIRE' | 'RETENUE_JUDICIAIRE' | 'RETENUE_AVALISEUR' | 'VENTILATION';
  beneficiaire?: string;
  beneficiaireRib?: string;
  reference?: string;
}

export interface FlatFileResult {
  content: string;
  fileName: string;
  totalTransactions: number;
  totalAmount: number;
  details?: FlatFileDetail[];
}

export interface FlatFileOptions {
  initiatingParty: string;
  periodeLabel: string;
  reference: string;
  codeBanque: string;
  mois: string;
  annee: string;
  companyCode?: string;
  feeType?: 'AVEC_FRAIS' | 'SANS_FRAIS' | 'CAS_PARTICULIER';
  motif?: string;
}

export interface SplittingRuleForExport {
  id: string;
  rule_name: string;
  rule_type: string;
  id_societaire: string;
  nom_societaire?: string;
  rib_courant_cible: string | null;
  rib_epargne_cible: string | null;
  beneficiaire_nom: string | null;
  beneficiaire_rib: string | null;
  montant_saisie: number | null;
  percentage_courant: number;
  percentage_epargne: number;
  montant_total: number;
  reference_juridique?: string;
}

/**
 * Normalise un RIB bénéficiaire (peut arriver en 21 ou 23 caractères).
 * Retourne toujours { rib: 21 chars, cle: 2 chars }.
 */
function normalizeBeneficiaireRib(raw: string): { rib: string; cle: string } | null {
  if (!raw) return null;
  const clean = raw.replace(/[\s\-]/g, '');
  if (clean.length === 23) {
    return { rib: clean.substring(0, 21), cle: clean.slice(-2) };
  }
  if (clean.length === 21) {
    // Convention: les 2 derniers caractères sont la clé RIB
    return { rib: clean, cle: clean.slice(-2) };
  }
  if (clean.length >= 21) {
    return { rib: clean.substring(0, 21), cle: clean.slice(-2) };
  }
  return null;
}

function completeRib(
  rib: string,
  cleRib?: string,
  feeType?: 'AVEC_FRAIS' | 'SANS_FRAIS' | 'CAS_PARTICULIER',
  beneficiaireRib?: string,
  beneficiaireCle?: string
): { rib: string; cle: string } {
  // 🔴 Priorité absolue : si un RIB bénéficiaire est fourni, on l'utilise.
  if (beneficiaireRib) {
    const normalized = normalizeBeneficiaireRib(beneficiaireRib);
    if (normalized) {
      const cle = (beneficiaireCle && beneficiaireCle.trim().length > 0)
        ? beneficiaireCle.padStart(2, '0').slice(0, 2)
        : normalized.cle;
      return { rib: normalized.rib, cle };
    }
  }

  let cleanRib = (rib || '').replace(/[\s\-]/g, '');
  let cle = cleRib || '';

  if (feeType === 'CAS_PARTICULIER') {
    const bankCode = cleanRib.substring(0, 5);
    const branchCode = cleanRib.substring(5, 10);
    const originalCleRib = cleanRib.length >= 23 ? cleanRib.slice(-2) : cleRib || '';
    const neutralizedRib = bankCode + branchCode + '38100000000';
    return { rib: neutralizedRib, cle: originalCleRib.padStart(2, '0').slice(0, 2) };
  }

  if (cleanRib.length === 21 && cle.length === 2) return { rib: cleanRib, cle };
  if (cleanRib.length === 21 && cle.length === 1) return { rib: cleanRib, cle: '0' + cle };
  if (cleanRib.length === 21 && cle.length === 0) return { rib: cleanRib, cle: cleanRib.slice(-2) };
  if (cleanRib.length === 23) return { rib: cleanRib.substring(0, 21), cle: cleanRib.slice(-2) };

  cleanRib = cleanRib.padStart(21, '0');
  if (cle.length === 0) cle = cleanRib.slice(-2);
  else cle = cle.padStart(2, '0').slice(0, 2);
  return { rib: cleanRib, cle };
}

export function generateFlatFileFromImportData(
  rows: FlatFileRow[],
  options: FlatFileOptions
): FlatFileResult {
  const lines: string[] = [];
  const details: FlatFileDetail[] = [];

  let totalAmount = 0;
  let nbTransactions = 0;

  const allTransactions: Array<{
    nom: string;
    rib: string;
    cleRib: string;
    montant: number;
    isJudiciaire?: boolean;
    isAval?: boolean;
    beneficiaireNom?: string;
    beneficiaireRib?: string;
    referenceJuridique?: string;
  }> = [];

  for (const row of rows) {
    if (row.splits && row.splits.length > 0) {
      for (const split of row.splits) {
        const isJud = split.isJudiciaire || row.isJudiciaire;
        const isAvl = split.isAval || row.isAval;
        const benefRib = split.beneficiaireRib || row.beneficiaireRib;
        const benefCle = split.beneficiaireCle;
        const benefNom = split.beneficiaireNom || row.beneficiaireNom;

        // 🔴 Pour saisies/avals: on force le RIB du bénéficiaire dans completeRib
        const { rib: fullRib, cle: computedCle } = completeRib(
          split.rib,
          split.cleRib,
          options.feeType,
          (isJud || isAvl) ? benefRib : undefined,
          (isJud || isAvl) ? benefCle : undefined
        );

        totalAmount += split.montant;
        nbTransactions++;

        // Nom affiché = bénéficiaire pour saisies/avals, sinon sociétaire
        const nomAffiche = (isJud || isAvl)
          ? (benefNom || row.nom_complet)
          : row.nom_complet;

        allTransactions.push({
          nom: nomAffiche,
          rib: fullRib,
          cleRib: computedCle,
          montant: split.montant,
          isJudiciaire: isJud,
          isAval: isAvl,
          beneficiaireNom: benefNom,
          beneficiaireRib: benefRib,
          referenceJuridique: split.referenceJuridique || row.referenceJuridique
        });

        details.push({
          nom_complet: nomAffiche,
          rib: fullRib,
          montant: split.montant,
          type: isJud ? 'RETENUE_JUDICIAIRE' : isAvl ? 'RETENUE_AVALISEUR' : 'VENTILATION',
          beneficiaire: benefNom,
          beneficiaireRib: benefRib,
          reference: split.referenceJuridique || row.referenceJuridique
        });
      }
    } else {
      const isJud = row.isJudiciaire;
      const isAvl = row.isAval;
      const { rib: fullRib, cle: computedCle } = completeRib(
        row.rib,
        row.cleRib,
        options.feeType,
        (isJud || isAvl) ? row.beneficiaireRib : undefined,
        (isJud || isAvl) ? row.beneficiaireCle : undefined
      );
      totalAmount += row.montant;
      nbTransactions++;

      const nomBeneficiaire = (isJud || isAvl)
        ? (row.beneficiaireNom || row.nom_complet)
        : row.nom_complet;
      const type: FlatFileDetail['type'] =
        isJud ? 'RETENUE_JUDICIAIRE' : isAvl ? 'RETENUE_AVALISEUR' : 'SALAIRE';

      allTransactions.push({
        nom: nomBeneficiaire,
        rib: fullRib,
        cleRib: computedCle,
        montant: row.montant,
        isJudiciaire: isJud,
        isAval: isAvl,
        beneficiaireNom: row.beneficiaireNom,
        beneficiaireRib: row.beneficiaireRib,
        referenceJuridique: row.referenceJuridique
      });

      details.push({
        nom_complet: nomBeneficiaire,
        rib: fullRib,
        montant: row.montant,
        type,
        beneficiaire: row.beneficiaireNom,
        beneficiaireRib: row.beneficiaireRib,
        reference: row.referenceJuridique
      });
    }
  }

  const totalAmountStr = Math.round(totalAmount).toString().padStart(12, '0');
  const nbTransactionsStr = nbTransactions.toString().padStart(6, '0');
  const dateCode = `${options.mois.padStart(2, '0')}${options.annee.slice(-2)}`;
  const companyCodeStr = (options.companyCode || options.initiatingParty.substring(0, 8).toUpperCase()).padEnd(8, ' ');

  let technicalAccount: string;
  let cleRibCFD: string;
  switch (options.feeType) {
    case 'SANS_FRAIS':
      technicalAccount = '300050019738100000000';
      cleRibCFD = '69';
      break;
    case 'CAS_PARTICULIER':
      technicalAccount = '300050000038100000000';
      cleRibCFD = '69';
      break;
    default:
      technicalAccount = '300050019738100300000';
      cleRibCFD = '35';
      break;
  }

  const motifBase = options.motif && options.motif.trim() !== '' ? options.motif.trim().toUpperCase() : 'SALAIRE';
  const motifClean = motifBase.replace(/[^A-Z]/g, '');

  const headerPrefix = `1        ${dateCode}CFD BZV`.padEnd(30, ' ');
  const technicalAccountPadded = technicalAccount.padEnd(21, ' ');
  const amountBlock = `${cleRibCFD}${nbTransactionsStr}${totalAmountStr}`;
  const headerLine = `${headerPrefix}${technicalAccountPadded}     ${amountBlock}${companyCodeStr}                            950`;
  lines.push(headerLine);

  for (const tx of allTransactions) {
    let nom = tx.nom
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z\s]/g, '')
      .substring(0, 50);
    nom = nom.padEnd(50, ' ');

    const ribBase = tx.rib.substring(0, 21).padEnd(21, ' ');
    const ribFormatted = ribBase.padEnd(27, ' ');
    const ribKey = tx.cleRib.padStart(2, '0').slice(0, 2);
    const montantPart = Math.round(tx.montant).toString().padStart(12, '0');
    const amountBlockDetail = `${ribKey}${montantPart}`;

    let motif: string;
    if (tx.isJudiciaire) {
      const ref = tx.referenceJuridique ? `_${tx.referenceJuridique}` : '';
      motif = `${motifClean}_SAISIE${ref}_${dateCode}`.substring(0, 50);
    } else if (tx.isAval) {
      motif = `${motifClean}_AVAL_${dateCode}`.substring(0, 50);
    } else {
      motif = `${motifClean}_${dateCode}`.substring(0, 50);
    }

    const detailLine = `2            ${nom}${ribFormatted}     ${amountBlockDetail}${motif}`;
    lines.push(detailLine);
  }

  const content = lines.join('\n');
  const suffix = options.feeType === 'SANS_FRAIS' ? 'SANSFRAIS'
    : options.feeType === 'CAS_PARTICULIER' ? 'CASPARTICULIER'
    : 'AVECFRAIS';
  const fileName = `PAIEMENT_${companyCodeStr.trim()}_${motifClean}_${dateCode}_${suffix}.txt`;

  return { content, fileName, totalTransactions: nbTransactions, totalAmount, details };
}

export function generateFlatFileFromRules(
  rules: SplittingRuleForExport[],
  options: FlatFileOptions
): FlatFileResult {
  const rows: FlatFileRow[] = [];

  for (const rule of rules) {
    if ((rule.rule_type === 'SAISIE_JURIDIQUE' || rule.rule_type === 'SAISIE_AVAL') && rule.beneficiaire_rib) {
      const normalized = normalizeBeneficiaireRib(rule.beneficiaire_rib);
      if (!normalized) continue;
      const isJud = rule.rule_type === 'SAISIE_JURIDIQUE';
      const defaultNom = isJud ? 'BENEFICIAIRE' : 'COMPTE_REGULARISATION';

      rows.push({
        nom_complet: rule.nom_societaire || (isJud ? 'SOCIETAIRE' : 'AVALISEUR'),
        rib: rule.rib_courant_cible ? rule.rib_courant_cible.slice(0, -2) : '',
        cleRib: rule.rib_courant_cible ? rule.rib_courant_cible.slice(-2) : '',
        montant: rule.montant_saisie || 0,
        isJudiciaire: isJud,
        isAval: !isJud,
        beneficiaireNom: rule.beneficiaire_nom || defaultNom,
        beneficiaireRib: normalized.rib,
        beneficiaireCle: normalized.cle,
        referenceJuridique: rule.reference_juridique || undefined,
        splits: [{
          rib: normalized.rib,
          cleRib: normalized.cle,
          montant: rule.montant_saisie || 0,
          isJudiciaire: isJud,
          isAval: !isJud,
          beneficiaireRib: normalized.rib,
          beneficiaireCle: normalized.cle,
          beneficiaireNom: rule.beneficiaire_nom || defaultNom,
          referenceJuridique: rule.reference_juridique || undefined
        }]
      });
    } else if (rule.rule_type === 'VENTILATION' && rule.percentage_epargne > 0 && rule.rib_epargne_cible) {
      const ribEpargne = rule.rib_epargne_cible;
      const montantEpargne = rule.montant_total * (rule.percentage_epargne / 100);
      const ribCourant = rule.rib_courant_cible || '';

      rows.push({
        nom_complet: rule.nom_societaire || 'SOCIETAIRE',
        rib: ribCourant.slice(0, -2) || '',
        cleRib: ribCourant.slice(-2) || '',
        montant: montantEpargne,
        splits: [{
          rib: ribEpargne.slice(0, -2),
          montant: montantEpargne,
          cleRib: ribEpargne.slice(-2)
        }]
      });
    }
  }

  return generateFlatFileFromImportData(rows, options);
}

/** Utilitaire de debug pour analyser un fichier généré. */
export function analyzeGeneratedFile(result: FlatFileResult): void {
  console.log('='.repeat(60));
  console.log('📊 ANALYSE DU FICHIER GÉNÉRÉ');
  console.log('='.repeat(60));
  console.log(`📁 Fichier: ${result.fileName}`);
  console.log(`📝 Transactions: ${result.totalTransactions}`);
  console.log(`💰 Montant total: ${result.totalAmount.toLocaleString('fr-FR')} XAF`);
  console.log('-'.repeat(60));

  if (result.details && result.details.length > 0) {
    for (const detail of result.details) {
      const typeEmoji =
        detail.type === 'RETENUE_JUDICIAIRE' ? '⚖️' :
        detail.type === 'RETENUE_AVALISEUR' ? '🛡️' :
        detail.type === 'VENTILATION' ? '💰' : '📄';
      console.log(`  ${typeEmoji} ${detail.nom_complet}`);
      console.log(`     RIB: ${detail.rib}`);
      console.log(`     Montant: ${detail.montant.toLocaleString('fr-FR')} XAF`);
      if (detail.beneficiaire) console.log(`     Bénéficiaire: ${detail.beneficiaire}`);
      if (detail.beneficiaireRib) console.log(`     RIB bénéficiaire: ${detail.beneficiaireRib}`);
      if (detail.reference) console.log(`     Réf: ${detail.reference}`);
    }
  }
  console.log('='.repeat(60));
}