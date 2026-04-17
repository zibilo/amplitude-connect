-- ============ NETTOYAGE DES DONNÉES EXISTANTES ============
TRUNCATE TABLE public.import_entries CASCADE;
TRUNCATE TABLE public.import_sessions CASCADE;
TRUNCATE TABLE public.payroll_entries CASCADE;
TRUNCATE TABLE public.payroll_imports CASCADE;
TRUNCATE TABLE public.generated_entries CASCADE;
TRUNCATE TABLE public.generated_files CASCADE;
TRUNCATE TABLE public.reconciliation_entries CASCADE;
TRUNCATE TABLE public.reconciliation_reports CASCADE;
TRUNCATE TABLE public.preflight_validations CASCADE;
TRUNCATE TABLE public.dry_run_results CASCADE;
TRUNCATE TABLE public.split_transactions CASCADE;
TRUNCATE TABLE public.rib_corrections CASCADE;
TRUNCATE TABLE public.integrity_alerts CASCADE;
TRUNCATE TABLE public.monthly_flux_counter CASCADE;
TRUNCATE TABLE public.file_staging CASCADE;
TRUNCATE TABLE public.processing_stats CASCADE;
TRUNCATE TABLE public.company_profiles CASCADE;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');
CREATE TYPE public.ville_region AS ENUM ('BRAZZAVILLE', 'POINTE_NOIRE');
CREATE TYPE public.validation_status AS ENUM ('pending', 'in_review', 'validated', 'rejected', 'transferred');

-- ============ TABLE PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  ville public.ville_region NOT NULL DEFAULT 'BRAZZAVILLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ TABLE USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  ville public.ville_region,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, ville)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ FONCTIONS SECURITY DEFINER ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_ville(_user_id UUID)
RETURNS public.ville_region
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ville FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_ville(_user_id UUID, _ville public.ville_region)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND ville = _ville
  ) OR public.is_super_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_access_ville(_user_id UUID, _ville public.ville_region)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR public.get_user_ville(_user_id) = _ville
$$;

-- ============ TRIGGER : auto-création profil + super admin ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ville public.ville_region;
BEGIN
  v_ville := COALESCE(
    (NEW.raw_user_meta_data->>'ville')::public.ville_region,
    'BRAZZAVILLE'
  );

  INSERT INTO public.profiles (user_id, email, display_name, ville)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    v_ville
  );

  -- Promotion automatique du Super Admin
  IF NEW.email = 'Pridol242@gmail.com' OR LOWER(NEW.email) = 'pridol242@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role, ville) VALUES (NEW.id, 'user', v_ville);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TRIGGERS updated_at ============
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POLITIQUES PROFILES ============
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admin can view all profiles" ON public.profiles
  FOR ALL USING (public.is_super_admin(auth.uid()));

-- ============ POLITIQUES USER_ROLES ============
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Only super admin can manage roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Only super admin can update roles" ON public.user_roles
  FOR UPDATE USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Only super admin can delete roles" ON public.user_roles
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- ============ AJOUT COLONNE VILLE AUX TABLES MÉTIER ============
ALTER TABLE public.company_profiles
  ADD COLUMN ville public.ville_region NOT NULL DEFAULT 'BRAZZAVILLE';

ALTER TABLE public.payroll_imports
  ADD COLUMN ville public.ville_region NOT NULL DEFAULT 'BRAZZAVILLE',
  ADD COLUMN created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.import_sessions
  ADD COLUMN ville public.ville_region NOT NULL DEFAULT 'BRAZZAVILLE',
  ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- ============ TABLE WORKFLOW VALIDATION ============
CREATE TABLE public.validation_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.payroll_imports(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  ville public.ville_region NOT NULL,
  status public.validation_status NOT NULL DEFAULT 'pending',
  submitted_by UUID REFERENCES auth.users(id),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  validation_method TEXT,
  rejection_reason TEXT,
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.validation_workflow ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_validation_workflow_updated_at
  BEFORE UPDATE ON public.validation_workflow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View workflow by ville" ON public.validation_workflow
  FOR SELECT USING (public.can_access_ville(auth.uid(), ville));

CREATE POLICY "Users create workflow in own ville" ON public.validation_workflow
  FOR INSERT WITH CHECK (public.can_access_ville(auth.uid(), ville));

CREATE POLICY "Admins validate workflow in own ville" ON public.validation_workflow
  FOR UPDATE USING (public.is_admin_of_ville(auth.uid(), ville));

-- ============ REMPLACEMENT POLITIQUES OUVERTES PAR GÉO-FENCING ============

-- company_profiles
DROP POLICY IF EXISTS "allow_all_company_profiles" ON public.company_profiles;
CREATE POLICY "View companies by ville" ON public.company_profiles
  FOR SELECT USING (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Insert companies in own ville" ON public.company_profiles
  FOR INSERT WITH CHECK (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Update companies in own ville" ON public.company_profiles
  FOR UPDATE USING (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Delete companies super admin" ON public.company_profiles
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- payroll_imports
DROP POLICY IF EXISTS "Allow all access to payroll_imports" ON public.payroll_imports;
CREATE POLICY "View imports by ville" ON public.payroll_imports
  FOR SELECT USING (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Insert imports in own ville" ON public.payroll_imports
  FOR INSERT WITH CHECK (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Update imports in own ville" ON public.payroll_imports
  FOR UPDATE USING (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Delete imports super admin" ON public.payroll_imports
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- import_sessions
DROP POLICY IF EXISTS "allow_all_import_sessions" ON public.import_sessions;
CREATE POLICY "View sessions by ville" ON public.import_sessions
  FOR SELECT USING (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Insert sessions in own ville" ON public.import_sessions
  FOR INSERT WITH CHECK (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Update sessions in own ville" ON public.import_sessions
  FOR UPDATE USING (public.can_access_ville(auth.uid(), ville));
CREATE POLICY "Delete sessions super admin" ON public.import_sessions
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- import_entries (lié via session)
DROP POLICY IF EXISTS "allow_all_import_entries" ON public.import_entries;
CREATE POLICY "View entries via session ville" ON public.import_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.import_sessions s
      WHERE s.id = import_entries.session_id
        AND public.can_access_ville(auth.uid(), s.ville)
    )
  );
CREATE POLICY "Insert entries via session ville" ON public.import_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.import_sessions s
      WHERE s.id = import_entries.session_id
        AND public.can_access_ville(auth.uid(), s.ville)
    )
  );
CREATE POLICY "Update entries via session ville" ON public.import_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.import_sessions s
      WHERE s.id = import_entries.session_id
        AND public.can_access_ville(auth.uid(), s.ville)
    )
  );

-- payroll_entries (lié via import)
DROP POLICY IF EXISTS "Allow all access to payroll_entries" ON public.payroll_entries;
CREATE POLICY "View payroll entries via import ville" ON public.payroll_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payroll_imports i
      WHERE i.id = payroll_entries.import_id
        AND public.can_access_ville(auth.uid(), i.ville)
    )
  );
CREATE POLICY "Insert payroll entries via import ville" ON public.payroll_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payroll_imports i
      WHERE i.id = payroll_entries.import_id
        AND public.can_access_ville(auth.uid(), i.ville)
    )
  );
CREATE POLICY "Update payroll entries via import ville" ON public.payroll_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.payroll_imports i
      WHERE i.id = payroll_entries.import_id
        AND public.can_access_ville(auth.uid(), i.ville)
    )
  );

-- audit_logs : seul super admin
DROP POLICY IF EXISTS "Allow all access to audit_logs" ON public.audit_logs;
CREATE POLICY "View audit logs authenticated" ON public.audit_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Insert audit logs authenticated" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- INDEX
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_company_profiles_ville ON public.company_profiles(ville);
CREATE INDEX idx_payroll_imports_ville ON public.payroll_imports(ville);
CREATE INDEX idx_import_sessions_ville ON public.import_sessions(ville);
CREATE INDEX idx_validation_workflow_ville ON public.validation_workflow(ville);
CREATE INDEX idx_validation_workflow_status ON public.validation_workflow(status);