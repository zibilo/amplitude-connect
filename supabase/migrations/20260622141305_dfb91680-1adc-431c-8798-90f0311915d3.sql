
-- ============================================================
-- ORACLE CONNECTIVITY & MIRROR TABLES
-- ============================================================

-- 1. Connexions Oracle (configuration des passerelles)
CREATE TABLE public.oracle_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 1521,
  service_name TEXT NOT NULL,
  schema_name TEXT NOT NULL DEFAULT 'AMPLITUDE',
  username TEXT NOT NULL,
  fdw_server_name TEXT,
  connection_type TEXT NOT NULL DEFAULT 'oracle_fdw' CHECK (connection_type IN ('oracle_fdw','etl','middleware')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oracle_connections TO authenticated;
GRANT ALL ON public.oracle_connections TO service_role;
ALTER TABLE public.oracle_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage oracle_connections" ON public.oracle_connections
FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Authenticated read oracle_connections" ON public.oracle_connections
FOR SELECT TO authenticated USING (true);

-- 2. Jobs de synchronisation
CREATE TABLE public.oracle_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.oracle_connections(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  source_table TEXT NOT NULL,
  target_table TEXT NOT NULL,
  sync_mode TEXT NOT NULL DEFAULT 'FULL' CHECK (sync_mode IN ('FULL','INCREMENTAL','UPSERT')),
  incremental_column TEXT,
  cron_schedule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_rows INTEGER DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oracle_sync_jobs TO authenticated;
GRANT ALL ON public.oracle_sync_jobs TO service_role;
ALTER TABLE public.oracle_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage oracle_sync_jobs" ON public.oracle_sync_jobs
FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Authenticated read oracle_sync_jobs" ON public.oracle_sync_jobs
FOR SELECT TO authenticated USING (true);

-- 3. Logs de synchronisation
CREATE TABLE public.oracle_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.oracle_sync_jobs(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.oracle_connections(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','SUCCESS','FAILED','PARTIAL')),
  rows_read INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.oracle_sync_logs TO authenticated;
GRANT ALL ON public.oracle_sync_logs TO service_role;
ALTER TABLE public.oracle_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read oracle_sync_logs" ON public.oracle_sync_logs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins write oracle_sync_logs" ON public.oracle_sync_logs
FOR INSERT TO authenticated WITH CHECK (public.is_admin_user(auth.uid()));

-- ============================================================
-- TABLES MIROIR AMPLITUDE
-- ============================================================

-- 4. Miroir Sociétaires
CREATE TABLE public.mirror_amplitude_societaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_societaire TEXT NOT NULL UNIQUE,
  matricule TEXT,
  nom TEXT,
  prenom TEXT,
  date_naissance DATE,
  lieu_naissance TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  code_employeur TEXT,
  date_adhesion DATE,
  statut TEXT,
  oracle_source_table TEXT DEFAULT 'AMPLITUDE.SOCIETAIRES',
  oracle_last_sync_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mirror_societaires_matricule ON public.mirror_amplitude_societaires(matricule);

GRANT SELECT ON public.mirror_amplitude_societaires TO authenticated;
GRANT ALL ON public.mirror_amplitude_societaires TO service_role;
ALTER TABLE public.mirror_amplitude_societaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mirror_societaires" ON public.mirror_amplitude_societaires
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write mirror_societaires" ON public.mirror_amplitude_societaires
FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- 5. Miroir Comptes
CREATE TABLE public.mirror_amplitude_comptes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_compte TEXT NOT NULL UNIQUE,
  rib TEXT,
  id_societaire TEXT,
  type_compte TEXT CHECK (type_compte IN ('COURANT','EPARGNE','DAT','AUTRE')),
  devise TEXT DEFAULT 'XAF',
  solde NUMERIC(18,2) DEFAULT 0,
  solde_disponible NUMERIC(18,2) DEFAULT 0,
  statut TEXT,
  decouvert_autorise NUMERIC(18,2) DEFAULT 0,
  date_ouverture DATE,
  date_cloture DATE,
  code_banque TEXT,
  code_guichet TEXT,
  cle_rib TEXT,
  oracle_last_sync_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mirror_comptes_societaire ON public.mirror_amplitude_comptes(id_societaire);
CREATE INDEX idx_mirror_comptes_rib ON public.mirror_amplitude_comptes(rib);

GRANT SELECT ON public.mirror_amplitude_comptes TO authenticated;
GRANT ALL ON public.mirror_amplitude_comptes TO service_role;
ALTER TABLE public.mirror_amplitude_comptes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mirror_comptes" ON public.mirror_amplitude_comptes
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write mirror_comptes" ON public.mirror_amplitude_comptes
FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- 6. Miroir Crédits
CREATE TABLE public.mirror_amplitude_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pret TEXT NOT NULL UNIQUE,
  id_societaire TEXT,
  matricule TEXT,
  type_credit TEXT,
  montant_initial NUMERIC(18,2),
  capital_restant_du NUMERIC(18,2),
  taux_interet NUMERIC(8,4),
  duree_mois INTEGER,
  date_octroi DATE,
  date_fin DATE,
  mensualite NUMERIC(18,2),
  compte_remboursement TEXT,
  statut TEXT,
  oracle_last_sync_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mirror_credits_matricule ON public.mirror_amplitude_credits(matricule);

GRANT SELECT ON public.mirror_amplitude_credits TO authenticated;
GRANT ALL ON public.mirror_amplitude_credits TO service_role;
ALTER TABLE public.mirror_amplitude_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mirror_credits" ON public.mirror_amplitude_credits
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write mirror_credits" ON public.mirror_amplitude_credits
FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- 7. Miroir Échéanciers
CREATE TABLE public.mirror_amplitude_echeanciers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pret TEXT NOT NULL,
  matricule TEXT,
  numero_echeance INTEGER,
  date_prelevement DATE,
  montant_total NUMERIC(18,2),
  capital NUMERIC(18,2),
  interets NUMERIC(18,2),
  assurance NUMERIC(18,2),
  statut TEXT,
  oracle_last_sync_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero_pret, numero_echeance)
);

CREATE INDEX idx_mirror_echeanciers_matricule ON public.mirror_amplitude_echeanciers(matricule);
CREATE INDEX idx_mirror_echeanciers_date ON public.mirror_amplitude_echeanciers(date_prelevement);

GRANT SELECT ON public.mirror_amplitude_echeanciers TO authenticated;
GRANT ALL ON public.mirror_amplitude_echeanciers TO service_role;
ALTER TABLE public.mirror_amplitude_echeanciers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mirror_echeanciers" ON public.mirror_amplitude_echeanciers
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write mirror_echeanciers" ON public.mirror_amplitude_echeanciers
FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- 8. Miroir Saisies judiciaires
CREATE TABLE public.mirror_amplitude_saisies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_saisie TEXT NOT NULL UNIQUE,
  id_societaire TEXT,
  matricule TEXT,
  type_saisie TEXT,
  montant_du NUMERIC(18,2),
  montant_preleve NUMERIC(18,2) DEFAULT 0,
  date_notification DATE,
  huissier TEXT,
  statut TEXT,
  oracle_last_sync_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mirror_saisies_matricule ON public.mirror_amplitude_saisies(matricule);

GRANT SELECT ON public.mirror_amplitude_saisies TO authenticated;
GRANT ALL ON public.mirror_amplitude_saisies TO service_role;
ALTER TABLE public.mirror_amplitude_saisies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mirror_saisies" ON public.mirror_amplitude_saisies
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write mirror_saisies" ON public.mirror_amplitude_saisies
FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER trg_oracle_connections_updated BEFORE UPDATE ON public.oracle_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_oracle_sync_jobs_updated BEFORE UPDATE ON public.oracle_sync_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mirror_societaires_updated BEFORE UPDATE ON public.mirror_amplitude_societaires
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mirror_comptes_updated BEFORE UPDATE ON public.mirror_amplitude_comptes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mirror_credits_updated BEFORE UPDATE ON public.mirror_amplitude_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mirror_echeanciers_updated BEFORE UPDATE ON public.mirror_amplitude_echeanciers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mirror_saisies_updated BEFORE UPDATE ON public.mirror_amplitude_saisies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
