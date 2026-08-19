-- Collaboration for team members without granting broad project administration.
-- Database authorization is the boundary; client controls are only a convenience.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_project_links(
  target_project_id UUID,
  target_resource_links JSONB,
  target_whatsapp_url TEXT,
  target_teams_meeting_url TEXT,
  target_github_url TEXT,
  target_drive_folder_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_item JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_project(target_project_id) THEN
    RAISE EXCEPTION 'PROJECT_ACCESS_DENIED';
  END IF;

  IF jsonb_typeof(COALESCE(target_resource_links, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(target_resource_links, '[]'::jsonb)) > 50 THEN
    RAISE EXCEPTION 'PROJECT_LINKS_INVALID';
  END IF;

  FOR link_item IN SELECT value FROM jsonb_array_elements(COALESCE(target_resource_links, '[]'::jsonb))
  LOOP
    IF jsonb_typeof(link_item) <> 'object'
       OR length(trim(COALESCE(link_item->>'id', ''))) NOT BETWEEN 1 AND 100
       OR length(trim(COALESCE(link_item->>'label', ''))) NOT BETWEEN 1 AND 120
       OR COALESCE(link_item->>'url', '') !~* '^https?://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'PROJECT_LINK_INVALID';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT value->>'id' AS link_id, count(*) AS occurrences
      FROM jsonb_array_elements(COALESCE(target_resource_links, '[]'::jsonb))
      GROUP BY value->>'id'
    ) duplicates WHERE occurrences > 1
  ) THEN
    RAISE EXCEPTION 'PROJECT_LINK_ID_DUPLICATED';
  END IF;

  IF target_whatsapp_url IS NOT NULL AND target_whatsapp_url !~* '^https?://[^[:space:]]+$'
    OR target_teams_meeting_url IS NOT NULL AND target_teams_meeting_url !~* '^https?://[^[:space:]]+$'
    OR target_github_url IS NOT NULL AND target_github_url !~* '^https?://[^[:space:]]+$'
    OR target_drive_folder_url IS NOT NULL AND target_drive_folder_url !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'PROJECT_LINK_URL_INVALID';
  END IF;

  UPDATE public.projects
  SET resource_links = COALESCE(target_resource_links, '[]'::jsonb),
      whatsapp_url = NULLIF(trim(target_whatsapp_url), ''),
      teams_meeting_url = NULLIF(trim(target_teams_meeting_url), ''),
      github_url = NULLIF(trim(target_github_url), ''),
      drive_folder_url = NULLIF(trim(target_drive_folder_url), ''),
      last_activity_at = now()
  WHERE id = target_project_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_project_links(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_links(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS issues_manage_monitor ON public.project_issues;
CREATE POLICY issues_update_project ON public.project_issues FOR UPDATE TO authenticated
  USING ((SELECT public.can_access_project(project_id)))
  WITH CHECK ((SELECT public.can_access_project(project_id)));

CREATE OR REPLACE FUNCTION public.prevent_issue_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.reported_by IS DISTINCT FROM OLD.reported_by THEN
    RAISE EXCEPTION 'ISSUE_IDENTITY_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS project_issues_identity_immutable ON public.project_issues;
CREATE TRIGGER project_issues_identity_immutable
  BEFORE UPDATE ON public.project_issues
  FOR EACH ROW EXECUTE FUNCTION public.prevent_issue_identity_change();

-- Capacity is informational. Management can accept or assign a student after
-- the nominal capacity is full, while membership remains exclusive.
CREATE OR REPLACE FUNCTION public.assign_student_to_project(target_student_id UUID, target_project_id UUID)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile public.profiles;
  target_project public.projects;
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Only management can assign students'; END IF;
  SELECT * INTO target_profile FROM public.profiles WHERE id = target_student_id FOR UPDATE;
  IF NOT FOUND OR target_profile.role <> 'student_group' OR NOT target_profile.is_active THEN
    RAISE EXCEPTION 'Student is not available for assignment';
  END IF;
  SELECT * INTO target_project FROM public.projects WHERE id = target_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
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
