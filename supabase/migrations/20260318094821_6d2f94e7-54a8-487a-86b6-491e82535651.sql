
-- Reference table for CCO and matricule corrections
CREATE TABLE public.reference_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule_errone text NOT NULL,
  cco_errone text,
  matricule_correct text NOT NULL,
  cco_correct text,
  commentaire text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.reference_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_reference_corrections" ON public.reference_corrections FOR ALL TO public USING (true) WITH CHECK (true);

-- Caisses table: code caisse → nom de caisse
CREATE TABLE public.caisses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_caisse text NOT NULL UNIQUE,
  nom_caisse text NOT NULL,
  zone_region text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.caisses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_caisses" ON public.caisses FOR ALL TO public USING (true) WITH CHECK (true);

-- Payroll import sessions (the 5-step wizard imports)
CREATE TABLE public.import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mois integer NOT NULL,
  annee integer NOT NULL,
  entreprise text,
  file_name text NOT NULL,
  total_lignes integer DEFAULT 0,
  lignes_valides integer DEFAULT 0,
  lignes_rejetees integer DEFAULT 0,
  lignes_doublons integer DEFAULT 0,
  montant_total numeric DEFAULT 0,
  status text DEFAULT 'pending',
  corrections_applied integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_import_sessions" ON public.import_sessions FOR ALL TO public USING (true) WITH CHECK (true);

-- Import session entries (raw imported lines after validation)
CREATE TABLE public.import_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  periode text NOT NULL,
  matricule text NOT NULL,
  nom text NOT NULL,
  prenom text,
  code_caisse text NOT NULL,
  cco text NOT NULL,
  montant numeric NOT NULL DEFAULT 0,
  matricule_original text,
  cco_original text,
  was_corrected boolean DEFAULT false,
  correction_details text,
  is_doublon boolean DEFAULT false,
  validation_error text,
  status text DEFAULT 'valid',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.import_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_import_entries" ON public.import_entries FOR ALL TO public USING (true) WITH CHECK (true);
