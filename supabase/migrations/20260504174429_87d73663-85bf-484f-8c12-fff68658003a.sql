
-- ============================================
-- MODULE ENGAGEMENTS & ÉCHÉANCIER (Crédits Amplitude)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cl_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pret TEXT NOT NULL UNIQUE,
  matricule TEXT NOT NULL,
  id_societaire TEXT,
  nom_client TEXT,
  rib_remboursement TEXT,
  montant_total NUMERIC(15,2) NOT NULL,
  capital_restant NUMERIC(15,2),
  duree_mois INTEGER NOT NULL,
  taux_interet NUMERIC(5,2),
  mensualite NUMERIC(15,2),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  compte_remboursement_interne TEXT,
  statut TEXT NOT NULL DEFAULT 'ACTIF',
  source TEXT DEFAULT 'AMPLITUDE',
  oracle_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cl_engagement_matricule ON public.cl_engagement(matricule);
CREATE INDEX IF NOT EXISTS idx_cl_engagement_statut ON public.cl_engagement(statut);

CREATE TABLE IF NOT EXISTS public.cl_echeancier (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES public.cl_engagement(id) ON DELETE CASCADE,
  numero_pret TEXT NOT NULL,
  matricule TEXT NOT NULL,
  numero_echeance INTEGER NOT NULL,
  date_prelevement DATE NOT NULL,
  capital NUMERIC(15,2) NOT NULL DEFAULT 0,
  interets NUMERIC(15,2) NOT NULL DEFAULT 0,
  assurance NUMERIC(15,2) NOT NULL DEFAULT 0,
  montant_total NUMERIC(15,2) NOT NULL,
  montant_paye NUMERIC(15,2) DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'A_PAYER', -- A_PAYER, PAYE, IMPAYE, PARTIEL
  date_paiement TIMESTAMPTZ,
  import_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(numero_pret, numero_echeance)
);
CREATE INDEX IF NOT EXISTS idx_cl_echeancier_matricule_date ON public.cl_echeancier(matricule, date_prelevement);
CREATE INDEX IF NOT EXISTS idx_cl_echeancier_statut ON public.cl_echeancier(statut);

-- ============================================
-- SAISIES FISCALES (SATD)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fiscal_seizures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_satd TEXT NOT NULL UNIQUE,
  matricule TEXT NOT NULL,
  nom_employe TEXT,
  organisme TEXT NOT NULL DEFAULT 'TRESOR_PUBLIC',
  motif TEXT,
  rib_beneficiaire TEXT NOT NULL,
  montant_du NUMERIC(15,2) NOT NULL,
  montant_preleve NUMERIC(15,2) DEFAULT 0,
  plafond_mensuel NUMERIC(15,2),
  date_notification DATE NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE,
  statut TEXT NOT NULL DEFAULT 'ACTIVE',
  priorite INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fiscal_seizures_matricule ON public.fiscal_seizures(matricule);

-- ============================================
-- AVANCES SUR SALAIRE
-- ============================================
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule TEXT NOT NULL,
  nom_employe TEXT,
  company_id UUID,
  periode TEXT NOT NULL, -- MM/YYYY
  montant NUMERIC(15,2) NOT NULL,
  motif TEXT,
  date_avance DATE NOT NULL,
  deduit BOOLEAN DEFAULT false,
  import_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salary_advances_matricule_periode ON public.salary_advances(matricule, periode);

-- ============================================
-- MUTUELLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.mutuelles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_mutuelle TEXT NOT NULL UNIQUE,
  nom_mutuelle TEXT NOT NULL,
  company_id UUID,
  compte_groupe TEXT NOT NULL,
  cotisation_defaut NUMERIC(15,2) DEFAULT 5000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mutuelle_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mutuelle_id UUID NOT NULL REFERENCES public.mutuelles(id) ON DELETE CASCADE,
  matricule TEXT NOT NULL,
  nom_employe TEXT,
  cotisation NUMERIC(15,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  date_adhesion DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mutuelle_id, matricule)
);
CREATE INDEX IF NOT EXISTS idx_mutuelle_members_matricule ON public.mutuelle_members(matricule);

-- ============================================
-- VENTILATION DES FRAIS PAR AGENCE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agency_fee_distributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID,
  generated_file_id UUID,
  code_agence TEXT NOT NULL,
  nom_agence TEXT,
  compte_produit TEXT NOT NULL,
  nombre_operations INTEGER NOT NULL DEFAULT 0,
  montant_total_frais NUMERIC(15,2) NOT NULL DEFAULT 0,
  reference_analytique TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agency_fee_dist_agence ON public.agency_fee_distributions(code_agence);
CREATE INDEX IF NOT EXISTS idx_agency_fee_dist_import ON public.agency_fee_distributions(import_id);

-- ============================================
-- RECOUVREMENT / ROLLBACK
-- ============================================
CREATE TABLE IF NOT EXISTS public.recovery_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  original_import_id UUID,
  company_id UUID,
  type_erreur TEXT NOT NULL, -- DOUBLE_PAIEMENT, ERREUR_MONTANT
  mode_recuperation TEXT NOT NULL, -- TOTAL, PARTIEL
  date_erreur DATE NOT NULL,
  justification TEXT NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  entries_count INTEGER NOT NULL DEFAULT 0,
  xml_content TEXT,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, GENERATED, EXPORTED, INJECTED
  generated_by UUID,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recovery_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recovery_file_id UUID NOT NULL REFERENCES public.recovery_files(id) ON DELETE CASCADE,
  matricule TEXT NOT NULL,
  nom_employe TEXT,
  rib TEXT NOT NULL,
  montant_a_debiter NUMERIC(15,2) NOT NULL,
  motif TEXT,
  selected BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_entries_file ON public.recovery_entries(recovery_file_id);

-- ============================================
-- REGISTRE D'EMPREINTES (Anti-doublon fichier)
-- ============================================
CREATE TABLE IF NOT EXISTS public.file_hash_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_hash TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  import_id UUID,
  imported_by UUID,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_file_hash_registry_hash ON public.file_hash_registry(file_hash);

-- ============================================
-- PRIORITÉS DE PAIEMENT (Configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_priorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  priority_order INTEGER NOT NULL UNIQUE,
  debt_type TEXT NOT NULL UNIQUE, -- SAISIE_FISCALE, SAISIE_JUDICIAIRE, CREDIT_BANCAIRE, AVANCE, MUTUELLE, EPARGNE, SALAIRE
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.payment_priorities (priority_order, debt_type, label, description) VALUES
  (1, 'SAISIE_FISCALE', 'Saisie Fiscale (SATD)', 'État - Trésor Public, prioritaire absolu'),
  (2, 'SAISIE_JUDICIAIRE', 'Saisie Judiciaire', 'Pension alimentaire, huissier'),
  (3, 'CREDIT_BANCAIRE', 'Crédit Bancaire', 'Remboursement échéancier Amplitude'),
  (4, 'AVANCE', 'Avances Employeur', 'Avances déjà versées par l''entreprise'),
  (5, 'MUTUELLE', 'Mutuelle / Cotisation', 'Caisses de solidarité'),
  (6, 'EPARGNE', 'Épargne Volontaire', 'Splitting vers compte épargne'),
  (7, 'SALAIRE', 'Salaire Disponible', 'Reste versé au compte courant')
ON CONFLICT (debt_type) DO NOTHING;

-- ============================================
-- TRIGGERS updated_at
-- ============================================
CREATE TRIGGER trg_cl_engagement_updated BEFORE UPDATE ON public.cl_engagement FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cl_echeancier_updated BEFORE UPDATE ON public.cl_echeancier FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fiscal_seizures_updated BEFORE UPDATE ON public.fiscal_seizures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mutuelles_updated BEFORE UPDATE ON public.mutuelles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_recovery_files_updated BEFORE UPDATE ON public.recovery_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.cl_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cl_echeancier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_seizures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutuelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutuelle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_fee_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_hash_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_priorities ENABLE ROW LEVEL SECURITY;

-- Lecture authentifiée
CREATE POLICY "auth_read_cl_engagement" ON public.cl_engagement FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_cl_echeancier" ON public.cl_echeancier FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_fiscal_seizures" ON public.fiscal_seizures FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_salary_advances" ON public.salary_advances FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_mutuelles" ON public.mutuelles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_mutuelle_members" ON public.mutuelle_members FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_agency_fee" ON public.agency_fee_distributions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_recovery_files" ON public.recovery_files FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_recovery_entries" ON public.recovery_entries FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_file_hash" ON public.file_hash_registry FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_priorities" ON public.payment_priorities FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Insert authentifié (pour imports Excel)
CREATE POLICY "auth_insert_cl_engagement" ON public.cl_engagement FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_cl_echeancier" ON public.cl_echeancier FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_fiscal_seizures" ON public.fiscal_seizures FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_salary_advances" ON public.salary_advances FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_mutuelles" ON public.mutuelles FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_mutuelle_members" ON public.mutuelle_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_agency_fee" ON public.agency_fee_distributions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_recovery_files" ON public.recovery_files FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_recovery_entries" ON public.recovery_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_file_hash" ON public.file_hash_registry FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Update/Delete admin uniquement
CREATE POLICY "admin_update_cl_engagement" ON public.cl_engagement FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_cl_engagement" ON public.cl_engagement FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_update_cl_echeancier" ON public.cl_echeancier FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_cl_echeancier" ON public.cl_echeancier FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_update_fiscal_seizures" ON public.fiscal_seizures FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_fiscal_seizures" ON public.fiscal_seizures FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_update_salary_advances" ON public.salary_advances FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_salary_advances" ON public.salary_advances FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_update_mutuelles" ON public.mutuelles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_mutuelles" ON public.mutuelles FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_update_mutuelle_members" ON public.mutuelle_members FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_mutuelle_members" ON public.mutuelle_members FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_agency_fee" ON public.agency_fee_distributions FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_update_recovery_files" ON public.recovery_files FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_recovery_files" ON public.recovery_files FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_update_recovery_entries" ON public.recovery_entries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()));
CREATE POLICY "admin_delete_recovery_entries" ON public.recovery_entries FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "admin_manage_priorities" ON public.payment_priorities FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- ============================================
-- FONCTIONS MÉTIER
-- ============================================

-- Récupérer la mensualité du mois pour un employé
CREATE OR REPLACE FUNCTION public.get_monthly_credit_amount(p_matricule TEXT, p_periode DATE)
RETURNS TABLE(numero_pret TEXT, montant_total NUMERIC, capital NUMERIC, interets NUMERIC, assurance NUMERIC, compte_remboursement TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.numero_pret, e.montant_total, e.capital, e.interets, e.assurance, ce.compte_remboursement_interne
  FROM public.cl_echeancier e
  JOIN public.cl_engagement ce ON ce.id = e.engagement_id
  WHERE e.matricule = p_matricule
    AND e.statut IN ('A_PAYER','IMPAYE','PARTIEL')
    AND date_trunc('month', e.date_prelevement) = date_trunc('month', p_periode)
    AND ce.statut = 'ACTIF';
$$;

-- Vérifier si un fichier est doublon
CREATE OR REPLACE FUNCTION public.check_file_duplicate(p_hash TEXT)
RETURNS TABLE(is_duplicate BOOLEAN, original_import_id UUID, original_file_name TEXT, imported_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT TRUE, fhr.import_id, fhr.file_name, fhr.imported_at
  FROM public.file_hash_registry fhr
  WHERE fhr.file_hash = p_hash
  LIMIT 1;
$$;

-- Calcul total des dettes prioritaires d'un employé pour la période
CREATE OR REPLACE FUNCTION public.calculate_employee_deductions(p_matricule TEXT, p_periode DATE, p_salaire_brut NUMERIC)
RETURNS TABLE(
  saisies_fiscales NUMERIC,
  saisies_judiciaires NUMERIC,
  credit_bancaire NUMERIC,
  avances NUMERIC,
  mutuelles NUMERIC,
  total_retenues NUMERIC,
  salaire_net NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_satd NUMERIC := 0;
  v_judic NUMERIC := 0;
  v_credit NUMERIC := 0;
  v_avances NUMERIC := 0;
  v_mut NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(LEAST(plafond_mensuel, montant_du - montant_preleve)), 0)
    INTO v_satd FROM public.fiscal_seizures
    WHERE matricule = p_matricule AND statut = 'ACTIVE';

  SELECT COALESCE(SUM(montant_saisie), 0) INTO v_judic
    FROM public.splitting_rules
    WHERE matricule = p_matricule AND rule_type = 'SAISIE_JUDICIAIRE' AND is_active = true;

  SELECT COALESCE(SUM(montant_total), 0) INTO v_credit
    FROM public.cl_echeancier
    WHERE matricule = p_matricule
      AND date_trunc('month', date_prelevement) = date_trunc('month', p_periode)
      AND statut IN ('A_PAYER','IMPAYE','PARTIEL');

  SELECT COALESCE(SUM(montant), 0) INTO v_avances
    FROM public.salary_advances
    WHERE matricule = p_matricule
      AND periode = to_char(p_periode, 'MM/YYYY')
      AND deduit = false;

  SELECT COALESCE(SUM(cotisation), 0) INTO v_mut
    FROM public.mutuelle_members
    WHERE matricule = p_matricule AND is_active = true;

  RETURN QUERY SELECT
    v_satd, v_judic, v_credit, v_avances, v_mut,
    (v_satd + v_judic + v_credit + v_avances + v_mut),
    GREATEST(0, p_salaire_brut - (v_satd + v_judic + v_credit + v_avances + v_mut));
END;
$$;
