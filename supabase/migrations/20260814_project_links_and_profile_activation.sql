-- Durable project links and user deactivation support.
-- Deactivation preserves the profile for audit purposes, removes its project
-- membership in the application flow, and prevents further project access.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS resource_links JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superuser' AND is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(target_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superuser()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND project_id = target_project_id AND is_active
    );
$$;

CREATE OR REPLACE FUNCTION public.assign_student_to_project(target_student_id UUID, target_project_id UUID)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile public.profiles;
  target_project public.projects;
  assigned_count INTEGER;
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Solo el monitor puede asignar estudiantes'; END IF;
  SELECT * INTO target_profile FROM public.profiles WHERE id = target_student_id FOR UPDATE;
  IF NOT FOUND OR target_profile.role <> 'student_group' OR NOT target_profile.is_active THEN
    RAISE EXCEPTION 'Estudiante no disponible para asignaciÃ³n';
  END IF;
  SELECT * INTO target_project FROM public.projects WHERE id = target_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proyecto no encontrado'; END IF;
  SELECT count(*) INTO assigned_count FROM public.profiles
    WHERE project_id = target_project_id AND role = 'student_group' AND is_active AND id <> target_student_id;
  IF assigned_count >= target_project.max_students THEN RAISE EXCEPTION 'El proyecto alcanzÃ³ su capacidad mÃ¡xima'; END IF;
  UPDATE public.profiles SET project_id = target_project_id WHERE id = target_student_id RETURNING * INTO target_profile;
  UPDATE public.project_applications
    SET status = CASE WHEN project_id = target_project_id THEN 'aceptada' ELSE 'rechazada' END
    WHERE student_id = target_student_id AND status = 'pendiente';
  INSERT INTO public.project_activity(project_id, activity_type, message, actor_id)
    VALUES (target_project_id, 'equipo', target_profile.full_name || ' fue asignado al proyecto.', auth.uid());
  RETURN target_profile;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_student_to_project(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_student_to_project(UUID, UUID) TO authenticated;

COMMIT;
