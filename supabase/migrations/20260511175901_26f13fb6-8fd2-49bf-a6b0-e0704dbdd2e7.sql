-- Rétablir le rôle super_admin pour Pridol242@gmail.com
-- Et s'assurer que la fonction handle_new_user promeut toujours cet email

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Trouver l'user_id de pridol242@gmail.com
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email ILIKE 'pridol242@gmail.com'
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Supprimer les rôles existants pour éviter les doublons, puis réinsérer super_admin
        DELETE FROM public.user_roles WHERE user_id = v_user_id;
        INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'super_admin');
    END IF;
END $$;

-- Mettre à jour la fonction handle_new_user pour s'assurer qu'elle promeut toujours cet email
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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

  -- Promotion automatique du Super Admin (email spécifique)
  IF NEW.email ILIKE 'pridol242@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role, ville) VALUES (NEW.id, 'user', v_ville);
  END IF;

  RETURN NEW;
END;
$function$;

-- Si jamais un trigger n'existe pas sur auth.users, le créer
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();