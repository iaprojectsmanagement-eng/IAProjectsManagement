-- Production hardening for the one-student/one-project operating model.
-- Apply after 20260807_operational_workflows.sql.

BEGIN;

-- A profile.project_id is the single source of truth for membership. The old
-- escape hatch allowed contradictory assignments and is intentionally removed.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS allow_multiple_projects;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  DROP CONSTRAINT IF EXISTS projects_progress_pct_check,
  DROP CONSTRAINT IF EXISTS projects_student_capacity_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_progress_pct_check CHECK (progress_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT projects_student_capacity_check CHECK (min_students >= 0 AND max_students >= min_students);

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.project_meetings
  ADD COLUMN IF NOT EXISTS agenda TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Bogota',
  ADD COLUMN IF NOT EXISTS calendar_event_url TEXT;

ALTER TABLE public.meeting_minutes
  ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES public.project_meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'borrador';
ALTER TABLE public.meeting_minutes DROP CONSTRAINT IF EXISTS meeting_minutes_status_check;
ALTER TABLE public.meeting_minutes ADD CONSTRAINT meeting_minutes_status_check CHECK (status IN ('borrador', 'aprobada'));
CREATE UNIQUE INDEX IF NOT EXISTS one_minute_per_meeting ON public.meeting_minutes(meeting_id) WHERE meeting_id IS NOT NULL;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['projects', 'project_tasks', 'project_issues', 'project_meetings', 'document_templates', 'project_documents']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', table_name, table_name);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_meeting_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'realizada' THEN
    RAISE EXCEPTION 'Una reunión realizada no puede cambiar de estado';
  END IF;
  IF OLD.status IN ('cancelada', 'no_realizada') AND NEW.status <> 'reprogramada' THEN
    RAISE EXCEPTION 'Una reunión cancelada o no realizada solo puede reprogramarse';
  END IF;
  IF NEW.status IN ('cancelada', 'no_realizada') AND NULLIF(trim(NEW.cancellation_reason), '') IS NULL THEN
    RAISE EXCEPTION 'El motivo es obligatorio para cancelar o marcar como no realizada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_project_meeting_change ON public.project_meetings;
CREATE TRIGGER validate_project_meeting_change
  BEFORE UPDATE OF status ON public.project_meetings
  FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_change();

-- Atomic monitor-only assignment. Updating project_id automatically removes the
-- previous membership because a profile has exactly one project_id.
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
  IF NOT FOUND OR target_profile.role <> 'student_group' THEN RAISE EXCEPTION 'Estudiante no encontrado'; END IF;
  SELECT * INTO target_project FROM public.projects WHERE id = target_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proyecto no encontrado'; END IF;
  SELECT count(*) INTO assigned_count FROM public.profiles WHERE project_id = target_project_id AND role = 'student_group' AND id <> target_student_id;
  IF assigned_count >= target_project.max_students THEN RAISE EXCEPTION 'El proyecto alcanzó su capacidad máxima'; END IF;

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

CREATE OR REPLACE FUNCTION public.remove_student_from_project(target_student_id UUID, expected_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE student_name TEXT;
BEGIN
  IF NOT public.is_superuser() THEN RAISE EXCEPTION 'Solo el monitor puede retirar estudiantes'; END IF;
  UPDATE public.profiles SET project_id = NULL
    WHERE id = target_student_id AND role = 'student_group' AND project_id = expected_project_id
    RETURNING full_name INTO student_name;
  IF student_name IS NULL THEN RAISE EXCEPTION 'La asignación indicada ya no existe'; END IF;
  INSERT INTO public.project_activity(project_id, activity_type, message, actor_id)
    VALUES (expected_project_id, 'equipo', student_name || ' fue retirado del proyecto.', auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.remove_student_from_project(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_student_from_project(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_profile_visible(target_profile_id UUID, target_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_profile_id = auth.uid()
    OR public.is_superuser()
    OR (target_project_id IS NOT NULL AND target_project_id = (SELECT project_id FROM public.profiles WHERE id = auth.uid()));
$$;

-- Replace permissive policies with least-privilege policies.
DROP POLICY IF EXISTS authenticated_read_projects ON public.projects;
DROP POLICY IF EXISTS superuser_manage_projects ON public.projects;
CREATE POLICY projects_read_assigned ON public.projects FOR SELECT TO authenticated
  USING (public.is_superuser() OR public.can_access_project(id));
CREATE POLICY projects_manage_monitor ON public.projects FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

DROP POLICY IF EXISTS own_or_superuser_read_profiles ON public.profiles;
DROP POLICY IF EXISTS superuser_manage_profiles ON public.profiles;
CREATE POLICY profiles_read_team ON public.profiles FOR SELECT TO authenticated
  USING (public.is_profile_visible(id, project_id));
CREATE POLICY profiles_manage_monitor ON public.profiles FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

DROP POLICY IF EXISTS operational_tasks_read ON public.project_tasks;
DROP POLICY IF EXISTS operational_tasks_insert ON public.project_tasks;
DROP POLICY IF EXISTS operational_tasks_update ON public.project_tasks;
DROP POLICY IF EXISTS operational_tasks_delete ON public.project_tasks;
CREATE POLICY tasks_read_project ON public.project_tasks FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY tasks_create_project ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id) AND created_by = auth.uid());
CREATE POLICY tasks_update_project ON public.project_tasks FOR UPDATE TO authenticated USING (public.can_access_project(project_id)) WITH CHECK (public.can_access_project(project_id));
CREATE POLICY tasks_delete_monitor ON public.project_tasks FOR DELETE TO authenticated USING (public.is_superuser());

DROP POLICY IF EXISTS operational_issues_read ON public.project_issues;
DROP POLICY IF EXISTS operational_issues_insert ON public.project_issues;
DROP POLICY IF EXISTS operational_issues_update ON public.project_issues;
DROP POLICY IF EXISTS operational_issues_delete ON public.project_issues;
CREATE POLICY issues_read_project ON public.project_issues FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY issues_report_project ON public.project_issues FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id) AND reported_by = auth.uid());
CREATE POLICY issues_manage_monitor ON public.project_issues FOR UPDATE TO authenticated USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY issues_delete_monitor ON public.project_issues FOR DELETE TO authenticated USING (public.is_superuser());

DROP POLICY IF EXISTS operational_meetings_read ON public.project_meetings;
DROP POLICY IF EXISTS operational_meetings_write ON public.project_meetings;
CREATE POLICY meetings_read_project ON public.project_meetings FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY meetings_create_project ON public.project_meetings FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id) AND created_by = auth.uid());
CREATE POLICY meetings_update_project ON public.project_meetings FOR UPDATE TO authenticated USING (public.can_access_project(project_id)) WITH CHECK (public.can_access_project(project_id));
CREATE POLICY meetings_delete_monitor ON public.project_meetings FOR DELETE TO authenticated USING (public.is_superuser());

DROP POLICY IF EXISTS templates_read ON public.document_templates;
DROP POLICY IF EXISTS templates_manage ON public.document_templates;
CREATE POLICY templates_read_active_or_monitor ON public.document_templates FOR SELECT TO authenticated USING (is_active OR public.is_superuser());
CREATE POLICY templates_manage_monitor ON public.document_templates FOR ALL TO authenticated USING (public.is_superuser()) WITH CHECK (public.is_superuser());

DROP POLICY IF EXISTS documents_read ON public.project_documents;
DROP POLICY IF EXISTS documents_write ON public.project_documents;
DROP POLICY IF EXISTS documents_manage ON public.project_documents;
CREATE POLICY documents_read_project ON public.project_documents FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY documents_create_project ON public.project_documents FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id) AND generated_by = auth.uid() AND status = 'borrador');
CREATE POLICY documents_update_monitor ON public.project_documents FOR UPDATE TO authenticated USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY documents_delete_monitor ON public.project_documents FOR DELETE TO authenticated USING (public.is_superuser());

DROP POLICY IF EXISTS activity_read ON public.project_activity;
DROP POLICY IF EXISTS activity_insert ON public.project_activity;
CREATE POLICY activity_read_project ON public.project_activity FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY activity_create_project ON public.project_activity FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id) AND actor_id = auth.uid());

COMMIT;
