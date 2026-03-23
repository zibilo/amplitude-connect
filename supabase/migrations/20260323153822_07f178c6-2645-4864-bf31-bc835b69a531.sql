
ALTER TABLE public.splitting_rules 
  ADD COLUMN rule_type text NOT NULL DEFAULT 'VENTILATION',
  ADD COLUMN beneficiaire_nom text,
  ADD COLUMN beneficiaire_rib text,
  ADD COLUMN reference_juridique text,
  ADD COLUMN motif_saisie text,
  ADD COLUMN montant_saisie numeric,
  ADD COLUMN plafond_total numeric,
  ADD COLUMN total_deja_preleve numeric DEFAULT 0,
  ADD COLUMN date_debut date,
  ADD COLUMN date_fin date;

COMMENT ON COLUMN public.splitting_rules.rule_type IS 'VENTILATION (épargne) ou SAISIE_ARRET (judiciaire)';
COMMENT ON COLUMN public.splitting_rules.plafond_total IS 'Montant total de la dette, la règle se désactive automatiquement quand atteint';
COMMENT ON COLUMN public.splitting_rules.total_deja_preleve IS 'Cumul des montants déjà prélevés';
