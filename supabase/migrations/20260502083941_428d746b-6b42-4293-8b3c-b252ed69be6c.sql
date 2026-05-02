
-- 1. Fix function search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Lock down fee_schedules
DROP POLICY IF EXISTS "Allow all on fee_schedules" ON public.fee_schedules;

CREATE POLICY "Authenticated can view fee_schedules"
  ON public.fee_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert fee_schedules"
  ON public.fee_schedules FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can update fee_schedules"
  ON public.fee_schedules FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can delete fee_schedules"
  ON public.fee_schedules FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 3. Lock down generated_entries (restrict to authenticated users)
DROP POLICY IF EXISTS "Allow all on generated_entries" ON public.generated_entries;
DROP POLICY IF EXISTS "allow_all_entries" ON public.generated_entries;

CREATE POLICY "Authenticated can view generated_entries"
  ON public.generated_entries FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert generated_entries"
  ON public.generated_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update generated_entries"
  ON public.generated_entries FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can delete generated_entries"
  ON public.generated_entries FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
