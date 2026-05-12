-- Fix user administration visibility and validation status

-- 1) Add validation status used by the UI. Existing accounts remain valid.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_validated boolean NOT NULL DEFAULT true;

UPDATE public.profiles
SET is_validated = true
WHERE is_validated IS DISTINCT FROM true;

-- 2) Recreate safe SECURITY DEFINER helpers to avoid RLS recursion.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'super_admin'::public.app_role)
$$;

-- Keep compatibility with older policies/functions that call has_role(role, user_id).
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, _role)
$$;

-- 3) Restore the Super Admin role for the requested account.
INSERT INTO public.user_roles (user_id, role, ville)
SELECT u.id, 'super_admin'::public.app_role, NULL::public.ville_region
FROM auth.users u
WHERE lower(u.email) = lower('pridol242@gmail.com')
ON CONFLICT DO NOTHING;

UPDATE public.profiles p
SET is_validated = true
FROM auth.users u
WHERE p.user_id = u.id
  AND lower(u.email) = lower('pridol242@gmail.com');

-- 4) Make future signups create a profile with validation pending for normal users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ville public.ville_region;
  v_is_super_admin boolean;
BEGIN
  v_ville := COALESCE(
    (NEW.raw_user_meta_data->>'ville')::public.ville_region,
    'BRAZZAVILLE'::public.ville_region
  );

  v_is_super_admin := lower(NEW.email) = lower('pridol242@gmail.com');

  INSERT INTO public.profiles (user_id, email, display_name, ville, is_validated)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_ville,
    v_is_super_admin
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      ville = EXCLUDED.ville,
      is_validated = public.profiles.is_validated OR EXCLUDED.is_validated,
      updated_at = now();

  IF v_is_super_admin THEN
    INSERT INTO public.user_roles (user_id, role, ville)
    VALUES (NEW.id, 'super_admin'::public.app_role, NULL)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role, ville)
    VALUES (NEW.id, 'user'::public.app_role, v_ville)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) Replace recursive/duplicate policies on profiles with direct helper-based policies.
DROP POLICY IF EXISTS "Admins can validate profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "SuperAdmin_Full_Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "lecture_profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can validate profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- 6) Replace recursive/duplicate policies on user_roles with helper-based policies.
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "SuperAdmin_Full_Roles" ON public.user_roles;
DROP POLICY IF EXISTS "lecture_roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Only super admin can create roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Only super admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Only super admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));