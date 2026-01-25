-- ============================================
-- MODULE: GESTION INTELLIGENTE DES REJETS & SPLITTING
-- Migration complète - Version corrigée
-- ============================================

-- 1. ENUMS (si ils n'existent pas déjà)
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM (
    'ACTIF', 'GELE', 'CLOS', 'BLOQUE', 'SAISIE_ATTRIBUTION', 'DORMANT', 'SUSPENDU'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM (
    'COURANT', 'EPARGNE', 'DAT', 'CREDIT', 'SPECIAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.preflight_status AS ENUM (
    'VALID', 'REJECTED_FROZEN', 'REJECTED_CLOSED', 'REJECTED_BLOCKED',
    'REJECTED_RIB_INVALID', 'REJECTED_IDENTITY_MISMATCH', 'PENDING_CORRECTION', 'CORRECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.routing_destination AS ENUM (
    'CLM', 'CAISSE_FEDERALE', 'AGENCE_LOCALE', 'EXTERNE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TABLES (si elles n'existent pas)
-- ============================================

-- Cache des statuts de comptes (Miroir Oracle/Amplitude)
CREATE TABLE IF NOT EXISTS public.account_status_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rib TEXT NOT NULL UNIQUE,
  code_banque TEXT NOT NULL,
  code_guichet TEXT NOT NULL,
  numero_compte TEXT NOT NULL,
  cle_rib TEXT NOT NULL,
  id_societaire TEXT NOT NULL,
  nom_titulaire TEXT NOT NULL,
  prenom_titulaire TEXT,
  matricule_lie TEXT,
  account_status public.account_status NOT NULL DEFAULT 'ACTIF',
  account_type public.account_type NOT NULL DEFAULT 'COURANT',
  date_ouverture DATE,
  date_cloture DATE,
  date_gel DATE,
  motif_gel TEXT,
  solde_disponible DECIMAL(18,2),
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  oracle_source_id TEXT,
  sync_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mapping Matricule -> Sociétaire -> Comptes
CREATE TABLE IF NOT EXISTS public.member_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule TEXT NOT NULL,
  id_societaire TEXT NOT NULL,
  rib_courant TEXT,
  rib_epargne TEXT,
  rib_alternatif TEXT,
  accounts_verified BOOLEAN DEFAULT false,
  last_verification_at TIMESTAMPTZ,
  verification_notes TEXT,
  splitting_enabled BOOLEAN DEFAULT false,
  split_percentage_epargne DECIMAL(5,2) DEFAULT 0,
  split_percentage_courant DECIMAL(5,2) DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(matricule, id_societaire)
);

-- Règles de Splitting
CREATE TABLE IF NOT EXISTS public.splitting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  matricule TEXT,
  id_societaire TEXT,
  employeur_code TEXT,
  percentage_courant DECIMAL(5,2) NOT NULL DEFAULT 60,
  percentage_epargne DECIMAL(5,2) NOT NULL DEFAULT 40,
  montant_minimum_split DECIMAL(18,2) DEFAULT 10000,
  rib_courant_cible TEXT,
  rib_epargne_cible TEXT,
  identity_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Table de Routage (CLM vs Caisse Fédérale)
CREATE TABLE IF NOT EXISTS public.routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  employeur_code TEXT,
  code_agence_source TEXT,
  code_produit TEXT,
  destination public.routing_destination NOT NULL,
  code_banque_cible TEXT NOT NULL,
  code_guichet_cible TEXT NOT NULL,
  code_compte_produit TEXT,
  frais_fixes DECIMAL(18,2) DEFAULT 0,
  frais_pourcentage DECIMAL(5,4) DEFAULT 0,
  compte_commission TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grille Tarifaire des Frais
CREATE TABLE IF NOT EXISTS public.fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_name TEXT NOT NULL,
  fee_code TEXT NOT NULL UNIQUE,
  montant_fixe DECIMAL(18,2) DEFAULT 0,
  pourcentage DECIMAL(5,4) DEFAULT 0,
  montant_minimum DECIMAL(18,2) DEFAULT 0,
  montant_maximum DECIMAL(18,2),
  type_operation TEXT,
  destination public.routing_destination,
  compte_encaissement TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Résultats de Validation Pré-Vol
CREATE TABLE IF NOT EXISTS public.preflight_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.payroll_imports(id) ON DELETE CASCADE,
  payroll_entry_id UUID REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  matricule TEXT NOT NULL,
  rib_source TEXT NOT NULL,
  montant DECIMAL(18,2) NOT NULL,
  preflight_status public.preflight_status NOT NULL,
  account_status_found public.account_status,
  id_societaire_found TEXT,
  error_code TEXT,
  error_message TEXT,
  error_details JSONB DEFAULT '{}',
  correction_proposed JSONB,
  correction_applied BOOLEAN DEFAULT false,
  corrected_rib TEXT,
  identity_check_passed BOOLEAN,
  identity_mismatch_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journal des Opérations de Splitting
CREATE TABLE IF NOT EXISTS public.split_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.payroll_imports(id),
  payroll_entry_id UUID REFERENCES public.payroll_entries(id),
  splitting_rule_id UUID REFERENCES public.splitting_rules(id),
  matricule TEXT NOT NULL,
  montant_total DECIMAL(18,2) NOT NULL,
  montant_courant DECIMAL(18,2) NOT NULL,
  rib_courant TEXT NOT NULL,
  montant_epargne DECIMAL(18,2) NOT NULL,
  rib_epargne TEXT NOT NULL,
  id_societaire_courant TEXT NOT NULL,
  id_societaire_epargne TEXT NOT NULL,
  identity_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Résultats de Simulation (Dry Run)
CREATE TABLE IF NOT EXISTS public.dry_run_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.payroll_imports(id),
  run_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_lignes INTEGER NOT NULL DEFAULT 0,
  lignes_valides INTEGER NOT NULL DEFAULT 0,
  lignes_rejetees INTEGER NOT NULL DEFAULT 0,
  lignes_a_splitter INTEGER NOT NULL DEFAULT 0,
  comptes_geles INTEGER DEFAULT 0,
  comptes_clos INTEGER DEFAULT 0,
  comptes_bloques INTEGER DEFAULT 0,
  rib_invalides INTEGER DEFAULT 0,
  erreurs_identite INTEGER DEFAULT 0,
  montant_total DECIMAL(18,2) DEFAULT 0,
  montant_valide DECIMAL(18,2) DEFAULT 0,
  montant_rejete DECIMAL(18,2) DEFAULT 0,
  frais_estimes DECIMAL(18,2) DEFAULT 0,
  details JSONB DEFAULT '{}',
  rejections_detail JSONB DEFAULT '[]',
  splits_detail JSONB DEFAULT '[]',
  routing_detail JSONB DEFAULT '[]',
  user_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log des Corrections de RIB
CREATE TABLE IF NOT EXISTS public.rib_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.payroll_imports(id),
  payroll_entry_id UUID REFERENCES public.payroll_entries(id),
  matricule TEXT NOT NULL,
  rib_original TEXT NOT NULL,
  rib_corrige TEXT NOT NULL,
  correction_source TEXT NOT NULL,
  correction_reason TEXT,
  auto_corrected BOOLEAN DEFAULT false,
  user_validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  validated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configuration des Codes Produits
CREATE TABLE IF NOT EXISTS public.product_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  libelle TEXT NOT NULL,
  destination public.routing_destination,
  code_banque_associe TEXT,
  code_guichet_associe TEXT,
  frais_applicables BOOLEAN DEFAULT false,
  fee_schedule_id UUID REFERENCES public.fee_schedules(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEX pour haute performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_acc_cache_rib ON public.account_status_cache(rib);
CREATE INDEX IF NOT EXISTS idx_acc_cache_matricule ON public.account_status_cache(matricule_lie);
CREATE INDEX IF NOT EXISTS idx_acc_cache_societaire ON public.account_status_cache(id_societaire);
CREATE INDEX IF NOT EXISTS idx_acc_cache_status ON public.account_status_cache(account_status);
CREATE INDEX IF NOT EXISTS idx_member_acc_matricule ON public.member_accounts(matricule);
CREATE INDEX IF NOT EXISTS idx_member_acc_societaire ON public.member_accounts(id_societaire);
CREATE INDEX IF NOT EXISTS idx_split_rules_matricule ON public.splitting_rules(matricule);
CREATE INDEX IF NOT EXISTS idx_split_rules_active ON public.splitting_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_routing_employeur ON public.routing_rules(employeur_code);
CREATE INDEX IF NOT EXISTS idx_routing_dest ON public.routing_rules(destination);
CREATE INDEX IF NOT EXISTS idx_preflight_import ON public.preflight_validations(import_id);
CREATE INDEX IF NOT EXISTS idx_preflight_status ON public.preflight_validations(preflight_status);
CREATE INDEX IF NOT EXISTS idx_preflight_matricule ON public.preflight_validations(matricule);
CREATE INDEX IF NOT EXISTS idx_split_tx_import ON public.split_transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_split_tx_matricule ON public.split_transactions(matricule);
CREATE INDEX IF NOT EXISTS idx_dry_run_import ON public.dry_run_results(import_id);

-- ============================================
-- TRIGGERS pour updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_account_status_cache_updated_at ON public.account_status_cache;
CREATE TRIGGER update_account_status_cache_updated_at
  BEFORE UPDATE ON public.account_status_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_accounts_updated_at ON public.member_accounts;
CREATE TRIGGER update_member_accounts_updated_at
  BEFORE UPDATE ON public.member_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_splitting_rules_updated_at ON public.splitting_rules;
CREATE TRIGGER update_splitting_rules_updated_at
  BEFORE UPDATE ON public.splitting_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_routing_rules_updated_at ON public.routing_rules;
CREATE TRIGGER update_routing_rules_updated_at
  BEFORE UPDATE ON public.routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.account_status_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.splitting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preflight_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dry_run_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rib_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_codes ENABLE ROW LEVEL SECURITY;

-- Policies permissives pour MVP
DROP POLICY IF EXISTS "Allow all on account_status_cache" ON public.account_status_cache;
CREATE POLICY "Allow all on account_status_cache" ON public.account_status_cache FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on member_accounts" ON public.member_accounts;
CREATE POLICY "Allow all on member_accounts" ON public.member_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on splitting_rules" ON public.splitting_rules;
CREATE POLICY "Allow all on splitting_rules" ON public.splitting_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on routing_rules" ON public.routing_rules;
CREATE POLICY "Allow all on routing_rules" ON public.routing_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on fee_schedules" ON public.fee_schedules;
CREATE POLICY "Allow all on fee_schedules" ON public.fee_schedules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on preflight_validations" ON public.preflight_validations;
CREATE POLICY "Allow all on preflight_validations" ON public.preflight_validations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on split_transactions" ON public.split_transactions;
CREATE POLICY "Allow all on split_transactions" ON public.split_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on dry_run_results" ON public.dry_run_results;
CREATE POLICY "Allow all on dry_run_results" ON public.dry_run_results FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on rib_corrections" ON public.rib_corrections;
CREATE POLICY "Allow all on rib_corrections" ON public.rib_corrections FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on product_codes" ON public.product_codes;
CREATE POLICY "Allow all on product_codes" ON public.product_codes FOR ALL USING (true) WITH CHECK (true);