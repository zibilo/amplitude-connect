-- =============================================
-- MUCO-AMPLITUDE: ARCHITECTURE BIG DATA
-- Schéma optimisé pour 2M+ lignes
-- =============================================

-- Table des imports de fichiers de paie
CREATE TABLE public.payroll_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT, -- SHA-256 checksum
  total_entries INTEGER DEFAULT 0,
  valid_entries INTEGER DEFAULT 0,
  invalid_entries INTEGER DEFAULT 0,
  total_amount DECIMAL(18, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des entrées de paie (optimisée pour Big Data)
CREATE TABLE public.payroll_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.payroll_imports(id) ON DELETE CASCADE,
  batch_number INTEGER DEFAULT 1, -- Pour le partitionnement logique
  matricule TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT,
  rib TEXT NOT NULL,
  code_banque TEXT,
  code_guichet TEXT,
  numero_compte TEXT,
  cle_rib TEXT,
  montant DECIMAL(18, 2) NOT NULL,
  rib_valid BOOLEAN DEFAULT false,
  rib_error TEXT,
  account_exists BOOLEAN, -- Résultat Sp_NombreEcriture
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'invalid', 'processed', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index B-Tree pour recherche ultra-rapide
CREATE INDEX idx_payroll_entries_matricule ON public.payroll_entries USING btree (matricule);
CREATE INDEX idx_payroll_entries_rib ON public.payroll_entries USING btree (rib);
CREATE INDEX idx_payroll_entries_import_id ON public.payroll_entries USING btree (import_id);
CREATE INDEX idx_payroll_entries_status ON public.payroll_entries USING btree (status);
CREATE INDEX idx_payroll_entries_batch ON public.payroll_entries USING btree (import_id, batch_number);

-- Table des fichiers générés
CREATE TABLE public.generated_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID REFERENCES public.payroll_imports(id) ON DELETE SET NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('xml', 'flat')),
  file_format TEXT NOT NULL CHECK (file_format IN ('MVTI_008', 'INT-VIRMU2')),
  file_name TEXT NOT NULL,
  file_content TEXT,
  file_hash TEXT, -- SHA-256 pour intégrité
  entries_count INTEGER NOT NULL DEFAULT 0,
  total_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
  destination_path TEXT DEFAULT 'C:\ODTSF\',
  transfer_status TEXT DEFAULT 'pending' CHECK (transfer_status IN ('pending', 'transferred', 'confirmed', 'failed')),
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_files_import ON public.generated_files USING btree (import_id);
CREATE INDEX idx_generated_files_status ON public.generated_files USING btree (transfer_status);

-- Table des rapports de réconciliation
CREATE TABLE public.reconciliation_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT,
  import_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_import_id UUID REFERENCES public.payroll_imports(id) ON DELETE SET NULL,
  total_sent DECIMAL(18, 2) DEFAULT 0,
  total_received DECIMAL(18, 2) DEFAULT 0,
  total_rejected DECIMAL(18, 2) DEFAULT 0,
  success_rate DECIMAL(5, 2) DEFAULT 0,
  entries_count INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  unmatched_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des entrées de réconciliation
CREATE TABLE public.reconciliation_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reconciliation_reports(id) ON DELETE CASCADE,
  payroll_entry_id UUID REFERENCES public.payroll_entries(id) ON DELETE SET NULL,
  rib TEXT NOT NULL,
  nom TEXT,
  montant_envoye DECIMAL(18, 2) NOT NULL,
  montant_recu DECIMAL(18, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'rejected', 'unmatched')),
  motif_rejet TEXT,
  code_rejet TEXT,
  date_compensation TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_entries_report ON public.reconciliation_entries USING btree (report_id);
CREATE INDEX idx_reconciliation_entries_rib ON public.reconciliation_entries USING btree (rib);
CREATE INDEX idx_reconciliation_entries_payroll ON public.reconciliation_entries USING btree (payroll_entry_id);

-- Table d'audit (traçabilité complète)
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID,
  action TEXT NOT NULL CHECK (action IN ('import', 'export', 'validation', 'reconciliation', 'generation', 'transfer', 'error', 'system')),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  description TEXT NOT NULL,
  entity_type TEXT, -- 'payroll_import', 'generated_file', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_audit_logs_session ON public.audit_logs USING btree (session_id);

-- Table de configuration système
CREATE TABLE public.system_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insérer les configurations par défaut
INSERT INTO public.system_config (key, value, description) VALUES
  ('batch_size', '5000', 'Nombre de lignes par batch pour l''insertion'),
  ('max_retries', '3', 'Nombre de tentatives en cas d''erreur'),
  ('output_path', '"C:\\ODTSF\\"', 'Chemin de dépôt des fichiers Amplitude'),
  ('oracle_timeout', '30000', 'Timeout connexion Oracle en ms'),
  ('stream_chunk_size', '1000', 'Taille des chunks pour le streaming');

-- Table de cache des matricules (Bloom Filter simplifié)
CREATE TABLE public.matricule_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurrence_count INTEGER DEFAULT 1
);

CREATE INDEX idx_matricule_cache_matricule ON public.matricule_cache USING btree (matricule);

-- Table des statistiques de traitement
CREATE TABLE public.processing_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID REFERENCES public.payroll_imports(id) ON DELETE CASCADE,
  batch_number INTEGER,
  rows_processed INTEGER DEFAULT 0,
  rows_valid INTEGER DEFAULT 0,
  rows_invalid INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  memory_used_mb DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_processing_stats_import ON public.processing_stats USING btree (import_id);

-- Enable RLS on all tables
ALTER TABLE public.payroll_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matricule_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies (accès public pour le MVP - à sécuriser avec auth plus tard)
CREATE POLICY "Allow all access to payroll_imports" ON public.payroll_imports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payroll_entries" ON public.payroll_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to generated_files" ON public.generated_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to reconciliation_reports" ON public.reconciliation_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to reconciliation_entries" ON public.reconciliation_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to system_config" ON public.system_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to matricule_cache" ON public.matricule_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to processing_stats" ON public.processing_stats FOR ALL USING (true) WITH CHECK (true);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_payroll_imports_updated_at
  BEFORE UPDATE ON public.payroll_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour calculer les statistiques d'import
CREATE OR REPLACE FUNCTION public.calculate_import_stats(p_import_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.payroll_imports
  SET 
    total_entries = (SELECT COUNT(*) FROM public.payroll_entries WHERE import_id = p_import_id),
    valid_entries = (SELECT COUNT(*) FROM public.payroll_entries WHERE import_id = p_import_id AND status = 'valid'),
    invalid_entries = (SELECT COUNT(*) FROM public.payroll_entries WHERE import_id = p_import_id AND status = 'invalid'),
    total_amount = (SELECT COALESCE(SUM(montant), 0) FROM public.payroll_entries WHERE import_id = p_import_id AND status = 'valid')
  WHERE id = p_import_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour le batch insert optimisé
CREATE OR REPLACE FUNCTION public.batch_insert_entries(
  p_import_id UUID,
  p_entries JSONB
)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO public.payroll_entries (
    import_id, batch_number, matricule, nom, prenom, rib,
    code_banque, code_guichet, numero_compte, cle_rib,
    montant, rib_valid, rib_error, status
  )
  SELECT 
    p_import_id,
    (entry->>'batch_number')::INTEGER,
    entry->>'matricule',
    entry->>'nom',
    entry->>'prenom',
    entry->>'rib',
    entry->>'code_banque',
    entry->>'code_guichet',
    entry->>'numero_compte',
    entry->>'cle_rib',
    (entry->>'montant')::DECIMAL,
    (entry->>'rib_valid')::BOOLEAN,
    entry->>'rib_error',
    COALESCE(entry->>'status', 'pending')
  FROM jsonb_array_elements(p_entries) AS entry;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;