-- ============================================
-- FONCTIONS PL/pgSQL HAUTE PERFORMANCE
-- Algorithmes métier pour gestion des rejets et splitting
-- ============================================

-- Fonction: Vérification de statut de compte
CREATE OR REPLACE FUNCTION public.check_account_status(p_rib TEXT)
RETURNS TABLE(
  status public.account_status,
  id_societaire TEXT,
  nom_titulaire TEXT,
  is_valid BOOLEAN,
  rejection_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acc.account_status,
    acc.id_societaire,
    acc.nom_titulaire,
    CASE 
      WHEN acc.account_status = 'ACTIF' THEN true
      ELSE false
    END AS is_valid,
    CASE 
      WHEN acc.account_status = 'GELE' THEN 'Compte gelé'
      WHEN acc.account_status = 'CLOS' THEN 'Compte clôturé'
      WHEN acc.account_status = 'BLOQUE' THEN 'Compte bloqué'
      WHEN acc.account_status = 'SAISIE_ATTRIBUTION' THEN 'Compte sous saisie-attribution'
      ELSE NULL
    END AS rejection_reason
  FROM public.account_status_cache acc
  WHERE acc.rib = p_rib;
END;
$$;

-- Fonction: Vérification d'identité pour splitting
CREATE OR REPLACE FUNCTION public.verify_split_identity(
  p_matricule TEXT,
  p_rib_courant TEXT,
  p_rib_epargne TEXT
)
RETURNS TABLE(
  identity_match BOOLEAN,
  id_societaire_courant TEXT,
  id_societaire_epargne TEXT,
  mismatch_details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_courant TEXT;
  v_id_epargne TEXT;
BEGIN
  SELECT acc.id_societaire INTO v_id_courant
  FROM public.account_status_cache acc
  WHERE acc.rib = p_rib_courant;
  
  SELECT acc.id_societaire INTO v_id_epargne
  FROM public.account_status_cache acc
  WHERE acc.rib = p_rib_epargne;
  
  RETURN QUERY
  SELECT 
    CASE WHEN v_id_courant = v_id_epargne AND v_id_courant IS NOT NULL THEN true ELSE false END,
    v_id_courant,
    v_id_epargne,
    CASE 
      WHEN v_id_courant IS NULL THEN 'Compte courant non trouvé'
      WHEN v_id_epargne IS NULL THEN 'Compte épargne non trouvé'
      WHEN v_id_courant != v_id_epargne THEN 'IDs sociétaires différents: ' || COALESCE(v_id_courant, 'NULL') || ' vs ' || COALESCE(v_id_epargne, 'NULL')
      ELSE NULL
    END;
END;
$$;

-- Fonction: Calcul des frais de virement
CREATE OR REPLACE FUNCTION public.calculate_transfer_fees(
  p_montant DECIMAL,
  p_destination public.routing_destination
)
RETURNS TABLE(
  frais_total DECIMAL,
  frais_fixes DECIMAL,
  frais_variables DECIMAL,
  montant_net DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frais_fixes DECIMAL := 0;
  v_frais_pct DECIMAL := 0;
  v_frais_variables DECIMAL := 0;
  v_frais_total DECIMAL := 0;
BEGIN
  SELECT 
    COALESCE(fs.montant_fixe, 0),
    COALESCE(fs.pourcentage, 0)
  INTO v_frais_fixes, v_frais_pct
  FROM public.fee_schedules fs
  WHERE fs.destination = p_destination
    AND fs.is_active = true
  LIMIT 1;
  
  v_frais_variables := p_montant * v_frais_pct;
  v_frais_total := v_frais_fixes + v_frais_variables;
  
  RETURN QUERY
  SELECT 
    v_frais_total,
    v_frais_fixes,
    v_frais_variables,
    p_montant - v_frais_total;
END;
$$;

-- Fonction: Obtenir la règle de routage applicable
CREATE OR REPLACE FUNCTION public.get_routing_rule(
  p_employeur_code TEXT,
  p_code_agence TEXT DEFAULT NULL
)
RETURNS TABLE(
  destination public.routing_destination,
  code_banque_cible TEXT,
  code_guichet_cible TEXT,
  frais_fixes DECIMAL,
  frais_pourcentage DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.destination,
    rr.code_banque_cible,
    rr.code_guichet_cible,
    rr.frais_fixes,
    rr.frais_pourcentage
  FROM public.routing_rules rr
  WHERE rr.is_active = true
    AND (rr.employeur_code = p_employeur_code OR rr.employeur_code IS NULL)
    AND (rr.code_agence_source = p_code_agence OR rr.code_agence_source IS NULL)
  ORDER BY rr.priority DESC
  LIMIT 1;
END;
$$;

-- Fonction: Exécution du Dry Run (simulation complète)
CREATE OR REPLACE FUNCTION public.execute_dry_run(p_import_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dry_run_id UUID;
  v_total INTEGER := 0;
  v_valides INTEGER := 0;
  v_rejetes INTEGER := 0;
  v_splits INTEGER := 0;
  v_geles INTEGER := 0;
  v_clos INTEGER := 0;
  v_bloques INTEGER := 0;
  v_rib_invalides INTEGER := 0;
  v_montant_total DECIMAL := 0;
  v_montant_valide DECIMAL := 0;
  v_montant_rejete DECIMAL := 0;
BEGIN
  INSERT INTO public.dry_run_results (import_id)
  VALUES (p_import_id)
  RETURNING id INTO v_dry_run_id;
  
  SELECT COUNT(*), COALESCE(SUM(montant), 0)
  INTO v_total, v_montant_total
  FROM public.payroll_entries
  WHERE import_id = p_import_id;
  
  SELECT COUNT(*), COALESCE(SUM(pe.montant), 0)
  INTO v_geles, v_montant_rejete
  FROM public.payroll_entries pe
  JOIN public.account_status_cache acc ON pe.rib = acc.rib
  WHERE pe.import_id = p_import_id
    AND acc.account_status = 'GELE';
  
  SELECT COUNT(*)
  INTO v_clos
  FROM public.payroll_entries pe
  JOIN public.account_status_cache acc ON pe.rib = acc.rib
  WHERE pe.import_id = p_import_id
    AND acc.account_status = 'CLOS';
  
  SELECT COUNT(*)
  INTO v_bloques
  FROM public.payroll_entries pe
  JOIN public.account_status_cache acc ON pe.rib = acc.rib
  WHERE pe.import_id = p_import_id
    AND acc.account_status = 'BLOQUE';
  
  SELECT COUNT(*)
  INTO v_splits
  FROM public.payroll_entries pe
  JOIN public.splitting_rules sr ON pe.matricule = sr.matricule
  WHERE pe.import_id = p_import_id
    AND sr.is_active = true;
  
  v_rejetes := v_geles + v_clos + v_bloques + v_rib_invalides;
  v_valides := v_total - v_rejetes;
  v_montant_valide := v_montant_total - v_montant_rejete;
  
  UPDATE public.dry_run_results
  SET 
    total_lignes = v_total,
    lignes_valides = v_valides,
    lignes_rejetees = v_rejetes,
    lignes_a_splitter = v_splits,
    comptes_geles = v_geles,
    comptes_clos = v_clos,
    comptes_bloques = v_bloques,
    rib_invalides = v_rib_invalides,
    montant_total = v_montant_total,
    montant_valide = v_montant_valide,
    montant_rejete = v_montant_rejete
  WHERE id = v_dry_run_id;
  
  RETURN v_dry_run_id;
END;
$$;

-- Fonction: Validation pré-vol complète d'une entrée
CREATE OR REPLACE FUNCTION public.preflight_validate_entry(
  p_import_id UUID,
  p_payroll_entry_id UUID,
  p_matricule TEXT,
  p_rib TEXT,
  p_montant DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation_id UUID;
  v_account_status public.account_status;
  v_id_societaire TEXT;
  v_status public.preflight_status;
  v_error_code TEXT;
  v_error_message TEXT;
BEGIN
  SELECT acc.account_status, acc.id_societaire 
  INTO v_account_status, v_id_societaire
  FROM public.account_status_cache acc
  WHERE acc.rib = p_rib;
  
  IF v_account_status IS NULL THEN
    v_status := 'PENDING_CORRECTION';
    v_error_code := 'ACCOUNT_NOT_FOUND';
    v_error_message := 'Compte non trouvé dans le cache';
  ELSIF v_account_status = 'GELE' THEN
    v_status := 'REJECTED_FROZEN';
    v_error_code := 'FROZEN_ACCOUNT';
    v_error_message := 'Compte gelé - Impossible de traiter';
  ELSIF v_account_status = 'CLOS' THEN
    v_status := 'REJECTED_CLOSED';
    v_error_code := 'CLOSED_ACCOUNT';
    v_error_message := 'Compte clôturé';
  ELSIF v_account_status = 'BLOQUE' THEN
    v_status := 'REJECTED_BLOCKED';
    v_error_code := 'BLOCKED_ACCOUNT';
    v_error_message := 'Compte bloqué';
  ELSIF v_account_status = 'SAISIE_ATTRIBUTION' THEN
    v_status := 'REJECTED_BLOCKED';
    v_error_code := 'SEIZED_ACCOUNT';
    v_error_message := 'Compte sous saisie-attribution';
  ELSE
    v_status := 'VALID';
    v_error_code := NULL;
    v_error_message := NULL;
  END IF;
  
  INSERT INTO public.preflight_validations (
    import_id,
    payroll_entry_id,
    matricule,
    rib_source,
    montant,
    preflight_status,
    account_status_found,
    id_societaire_found,
    error_code,
    error_message
  ) VALUES (
    p_import_id,
    p_payroll_entry_id,
    p_matricule,
    p_rib,
    p_montant,
    v_status,
    v_account_status,
    v_id_societaire,
    v_error_code,
    v_error_message
  )
  RETURNING id INTO v_validation_id;
  
  RETURN v_validation_id;
END;
$$;

-- Fonction: Appliquer le splitting d'un salaire
CREATE OR REPLACE FUNCTION public.apply_salary_split(
  p_import_id UUID,
  p_payroll_entry_id UUID,
  p_matricule TEXT,
  p_montant_total DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_split_id UUID;
  v_rule RECORD;
  v_montant_courant DECIMAL;
  v_montant_epargne DECIMAL;
  v_id_courant TEXT;
  v_id_epargne TEXT;
  v_identity_match BOOLEAN;
BEGIN
  SELECT * INTO v_rule
  FROM public.splitting_rules
  WHERE matricule = p_matricule
    AND is_active = true
  ORDER BY priority DESC
  LIMIT 1;
  
  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Aucune règle de splitting trouvée pour le matricule %', p_matricule;
  END IF;
  
  -- Vérifier l'identité
  SELECT acc.id_societaire INTO v_id_courant
  FROM public.account_status_cache acc
  WHERE acc.rib = v_rule.rib_courant_cible;
  
  SELECT acc.id_societaire INTO v_id_epargne
  FROM public.account_status_cache acc
  WHERE acc.rib = v_rule.rib_epargne_cible;
  
  v_identity_match := (v_id_courant = v_id_epargne AND v_id_courant IS NOT NULL);
  
  IF NOT v_identity_match THEN
    RAISE EXCEPTION 'Échec de vérification d''identité: IDs sociétaires différents';
  END IF;
  
  v_montant_courant := p_montant_total * (v_rule.percentage_courant / 100);
  v_montant_epargne := p_montant_total * (v_rule.percentage_epargne / 100);
  
  INSERT INTO public.split_transactions (
    import_id,
    payroll_entry_id,
    splitting_rule_id,
    matricule,
    montant_total,
    montant_courant,
    rib_courant,
    montant_epargne,
    rib_epargne,
    id_societaire_courant,
    id_societaire_epargne,
    identity_verified,
    status,
    processed_at
  ) VALUES (
    p_import_id,
    p_payroll_entry_id,
    v_rule.id,
    p_matricule,
    p_montant_total,
    v_montant_courant,
    v_rule.rib_courant_cible,
    v_montant_epargne,
    v_rule.rib_epargne_cible,
    v_id_courant,
    v_id_epargne,
    true,
    'processed',
    now()
  )
  RETURNING id INTO v_split_id;
  
  RETURN v_split_id;
END;
$$;

-- Fonction: Batch preflight validation (haute performance)
CREATE OR REPLACE FUNCTION public.batch_preflight_validate(p_import_id UUID)
RETURNS TABLE(
  total_validated INTEGER,
  total_valid INTEGER,
  total_rejected INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_total INTEGER := 0;
  v_valid INTEGER := 0;
  v_rejected INTEGER := 0;
BEGIN
  FOR v_entry IN 
    SELECT id, matricule, rib, montant
    FROM public.payroll_entries
    WHERE import_id = p_import_id
  LOOP
    PERFORM public.preflight_validate_entry(
      p_import_id,
      v_entry.id,
      v_entry.matricule,
      v_entry.rib,
      v_entry.montant
    );
    v_total := v_total + 1;
  END LOOP;
  
  SELECT COUNT(*) INTO v_valid
  FROM public.preflight_validations
  WHERE import_id = p_import_id
    AND preflight_status = 'VALID';
  
  v_rejected := v_total - v_valid;
  
  RETURN QUERY SELECT v_total, v_valid, v_rejected;
END;
$$;

-- Fonction: Proposer une correction de RIB basée sur le matricule
CREATE OR REPLACE FUNCTION public.propose_rib_correction(
  p_matricule TEXT,
  p_rib_invalid TEXT
)
RETURNS TABLE(
  has_correction BOOLEAN,
  corrected_rib TEXT,
  account_holder TEXT,
  correction_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corrected_rib TEXT;
  v_holder TEXT;
BEGIN
  -- Chercher un RIB valide pour ce matricule
  SELECT acc.rib, acc.nom_titulaire
  INTO v_corrected_rib, v_holder
  FROM public.account_status_cache acc
  WHERE acc.matricule_lie = p_matricule
    AND acc.account_status = 'ACTIF'
  LIMIT 1;
  
  IF v_corrected_rib IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      true,
      v_corrected_rib,
      v_holder,
      'RIB corrigé basé sur le matricule ' || p_matricule;
  ELSE
    RETURN QUERY
    SELECT 
      false,
      NULL::TEXT,
      NULL::TEXT,
      'Aucun compte actif trouvé pour le matricule ' || p_matricule;
  END IF;
END;
$$;

-- Fonction: Cross-check statutaire complet
CREATE OR REPLACE FUNCTION public.cross_check_entry(
  p_matricule TEXT,
  p_rib TEXT,
  p_montant DECIMAL
)
RETURNS TABLE(
  is_valid BOOLEAN,
  account_status public.account_status,
  needs_rib_correction BOOLEAN,
  proposed_rib TEXT,
  has_splitting_rule BOOLEAN,
  split_percentage_courant DECIMAL,
  split_percentage_epargne DECIMAL,
  routing_destination public.routing_destination,
  estimated_fees DECIMAL,
  error_messages TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc RECORD;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_proposed_rib TEXT;
  v_split RECORD;
  v_route RECORD;
  v_fees DECIMAL := 0;
BEGIN
  -- 1. Vérifier le statut du compte
  SELECT * INTO v_acc
  FROM public.account_status_cache acc
  WHERE acc.rib = p_rib;
  
  IF v_acc IS NULL THEN
    v_errors := array_append(v_errors, 'Compte non trouvé');
    
    -- Proposer correction
    SELECT correction.corrected_rib INTO v_proposed_rib
    FROM public.propose_rib_correction(p_matricule, p_rib) correction
    WHERE correction.has_correction = true;
  ELSIF v_acc.account_status != 'ACTIF' THEN
    v_errors := array_append(v_errors, 'Compte ' || v_acc.account_status::TEXT);
  END IF;
  
  -- 2. Vérifier règle de splitting
  SELECT * INTO v_split
  FROM public.splitting_rules
  WHERE matricule = p_matricule AND is_active = true
  LIMIT 1;
  
  -- 3. Obtenir routage
  SELECT * INTO v_route
  FROM public.routing_rules
  WHERE is_active = true
  ORDER BY priority DESC
  LIMIT 1;
  
  -- 4. Calculer frais estimés
  IF v_route IS NOT NULL THEN
    v_fees := COALESCE(v_route.frais_fixes, 0) + (p_montant * COALESCE(v_route.frais_pourcentage, 0));
  END IF;
  
  RETURN QUERY
  SELECT 
    (array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0),
    v_acc.account_status,
    (v_proposed_rib IS NOT NULL),
    v_proposed_rib,
    (v_split IS NOT NULL),
    COALESCE(v_split.percentage_courant, 100::DECIMAL),
    COALESCE(v_split.percentage_epargne, 0::DECIMAL),
    v_route.destination,
    v_fees,
    v_errors;
END;
$$;