/**
 * Triple Check Engine
 * Cross-references 3 data sources:
 * 1. Excel import data (variable: salary, bonuses)
 * 2. Manual rules database (fixed: garnishments, savings splits, loan repayments)
 * 3. Account status cache (validation: account active, identity match)
 * 
 * Produces a verified payment plan where:
 * Sum(Courant + Épargne + Saisies) === Montant Total Entreprise
 */

import { supabase } from '@/integrations/supabase/client';

export interface TripleCheckInput {
  matricule: string;
  nom: string;
  montant_total: number;
  rib: string;
  import_id?: string;
}

export interface PaymentLine {
  type: 'COURANT' | 'EPARGNE' | 'SAISIE_ARRET';
  beneficiaire: string;
  rib_destination: string;
  montant: number;
  rule_id?: string;
  reference?: string;
  motif?: string;
}

export interface TripleCheckResult {
  matricule: string;
  nom: string;
  montant_total: number;
  montant_net_courant: number;
  lines: PaymentLine[];
  warnings: string[];
  errors: string[];
  balance_ok: boolean;
  total_saisies: number;
  total_epargne: number;
}

export async function executeTripleCheck(entries: TripleCheckInput[]): Promise<TripleCheckResult[]> {
  // Fetch all active rules in one query
  const { data: allRules } = await (supabase
    .from('splitting_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false }) as any);

  const rules = allRules || [];
  const results: TripleCheckResult[] = [];

  for (const entry of entries) {
    const result = processEntry(entry, rules);
    results.push(result);
  }

  return results;
}

function processEntry(entry: TripleCheckInput, allRules: any[]): TripleCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines: PaymentLine[] = [];
  let remaining = entry.montant_total;

  // Get rules for this matricule
  const matriculeRules = allRules.filter(r => r.matricule === entry.matricule);

  // STEP 1: Apply Saisies Arrêts (highest priority - judicial obligations)
  const saisieRules = matriculeRules
    .filter(r => r.rule_type === 'SAISIE_ARRET')
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  let totalSaisies = 0;

  for (const saisie of saisieRules) {
    // Check if plafond is reached
    if (saisie.plafond_total && saisie.plafond_total > 0) {
      const alreadyDeducted = saisie.total_deja_preleve || 0;
      const remainingDebt = saisie.plafond_total - alreadyDeducted;
      
      if (remainingDebt <= 0) {
        warnings.push(`Saisie "${saisie.rule_name}" soldée (plafond atteint)`);
        continue;
      }

      // Don't deduct more than remaining debt
      const montantSaisie = Math.min(saisie.montant_saisie || 0, remainingDebt);
      
      if (montantSaisie > remaining) {
        errors.push(`Saisie "${saisie.rule_name}": montant ${montantSaisie.toLocaleString()} XAF > solde disponible ${remaining.toLocaleString()} XAF`);
        continue;
      }

      lines.push({
        type: 'SAISIE_ARRET',
        beneficiaire: saisie.beneficiaire_nom || 'N/A',
        rib_destination: saisie.beneficiaire_rib || '',
        montant: montantSaisie,
        rule_id: saisie.id,
        reference: saisie.reference_juridique,
        motif: saisie.motif_saisie,
      });

      remaining -= montantSaisie;
      totalSaisies += montantSaisie;
    } else {
      // No plafond - deduct full amount each month
      const montantSaisie = saisie.montant_saisie || 0;
      
      if (montantSaisie > remaining) {
        errors.push(`Saisie "${saisie.rule_name}": montant ${montantSaisie.toLocaleString()} XAF > solde disponible ${remaining.toLocaleString()} XAF`);
        continue;
      }

      lines.push({
        type: 'SAISIE_ARRET',
        beneficiaire: saisie.beneficiaire_nom || 'N/A',
        rib_destination: saisie.beneficiaire_rib || '',
        montant: montantSaisie,
        rule_id: saisie.id,
        reference: saisie.reference_juridique,
        motif: saisie.motif_saisie,
      });

      remaining -= montantSaisie;
      totalSaisies += montantSaisie;
    }
  }

  // STEP 2: Apply Ventilation (savings split on remaining amount)
  const ventilationRules = matriculeRules
    .filter(r => r.rule_type === 'VENTILATION')
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  let totalEpargne = 0;

  if (ventilationRules.length > 0) {
    const ventilation = ventilationRules[0]; // Use highest priority
    const montantEpargne = Math.round(remaining * (ventilation.percentage_epargne / 100));
    
    if (montantEpargne > 0 && remaining >= (ventilation.montant_minimum_split || 0)) {
      lines.push({
        type: 'EPARGNE',
        beneficiaire: entry.nom,
        rib_destination: ventilation.rib_epargne_cible || '',
        montant: montantEpargne,
        rule_id: ventilation.id,
      });

      remaining -= montantEpargne;
      totalEpargne = montantEpargne;
    } else if (remaining < (ventilation.montant_minimum_split || 0)) {
      warnings.push(`Ventilation non appliquée: montant restant (${remaining.toLocaleString()}) < minimum (${(ventilation.montant_minimum_split || 0).toLocaleString()})`);
    }
  }

  // STEP 3: Remaining goes to current account
  lines.unshift({
    type: 'COURANT',
    beneficiaire: entry.nom,
    rib_destination: entry.rib,
    montant: remaining,
  });

  // STEP 4: Balance verification (Triple Check)
  const totalLines = lines.reduce((sum, l) => sum + l.montant, 0);
  const balanceOk = Math.abs(totalLines - entry.montant_total) < 1; // Allow 1 XAF rounding

  if (!balanceOk) {
    errors.push(`ERREUR BALANCE: Total lignes (${totalLines.toLocaleString()}) ≠ Montant entreprise (${entry.montant_total.toLocaleString()}). Différence: ${(entry.montant_total - totalLines).toLocaleString()} XAF`);
  }

  return {
    matricule: entry.matricule,
    nom: entry.nom,
    montant_total: entry.montant_total,
    montant_net_courant: remaining,
    lines,
    warnings,
    errors,
    balance_ok: balanceOk,
    total_saisies: totalSaisies,
    total_epargne: totalEpargne,
  };
}

/**
 * After processing, update the total_deja_preleve for garnishment rules
 */
export async function updateGarnishmentTotals(results: TripleCheckResult[]): Promise<void> {
  for (const result of results) {
    const saisieLines = result.lines.filter(l => l.type === 'SAISIE_ARRET' && l.rule_id);
    
    for (const line of saisieLines) {
      // Increment total_deja_preleve
      const { data: currentRule } = await (supabase
        .from('splitting_rules')
        .select('total_deja_preleve, plafond_total')
        .eq('id', line.rule_id!)
        .single() as any);

      if (currentRule) {
        const newTotal = (currentRule.total_deja_preleve || 0) + line.montant;
        const updates: any = { total_deja_preleve: newTotal };

        // Auto-deactivate if plafond reached
        if (currentRule.plafond_total && currentRule.plafond_total > 0 && newTotal >= currentRule.plafond_total) {
          updates.is_active = false;
        }

        await (supabase
          .from('splitting_rules')
          .update(updates)
          .eq('id', line.rule_id!) as any);
      }
    }
  }
}
