-- Correction des fonctions avec search_path sécurisé
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;