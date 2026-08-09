-- Private project files and immutable audit events.
-- Apply after 20260808_production_hardening.sql.

BEGIN;

ALTER TABLE public.meeting_minutes
  ADD COLUMN IF NOT EXISTS transcript_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS doc_storage_path TEXT;

ALTER TABLE public.project_documents ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'team', 'application', 'task', 'issue', 'meeting', 'minute', 'template', 'document')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'assign', 'approve', 'status_change', 'upload')),
  before_data JSONB,
  after_data JSONB,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_project_created ON public.audit_log(project_id, created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_read_monitor ON public.audit_log;
DROP POLICY IF EXISTS audit_insert_actor ON public.audit_log;
CREATE POLICY audit_read_monitor ON public.audit_log FOR SELECT TO authenticated USING (public.is_superuser());
CREATE POLICY audit_insert_actor ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND (project_id IS NULL OR public.can_access_project(project_id)));

DROP POLICY IF EXISTS documents_update_creator_draft ON public.project_documents;
CREATE POLICY documents_update_creator_draft ON public.project_documents FOR UPDATE TO authenticated
  USING (generated_by = auth.uid() AND status = 'borrador')
  WITH CHECK (generated_by = auth.uid() AND status = 'borrador');

-- Safe catalog for unassigned students. It deliberately omits contacts, private
-- links, datasets, technical risks and activity.
CREATE OR REPLACE FUNCTION public.list_available_projects()
RETURNS TABLE (
  id UUID, folder_name TEXT, company_name TEXT, title TEXT,
  challenge_description TEXT, min_students INTEGER, max_students INTEGER,
  assigned_students BIGINT, progress_status TEXT, progress_pct INTEGER, risk_level TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.folder_name, c.name, p.title, p.challenge_description,
    p.min_students, p.max_students,
    count(pr.id) FILTER (WHERE pr.role = 'student_group') AS assigned_students,
    p.progress_status, p.progress_pct, p.risk_level
  FROM public.projects p
  LEFT JOIN public.companies c ON c.id = p.company_id
  LEFT JOIN public.profiles pr ON pr.project_id = p.id
  WHERE auth.uid() IS NOT NULL
  GROUP BY p.id, c.name;
$$;
REVOKE ALL ON FUNCTION public.list_available_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_available_projects() TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('project-transcripts', 'project-transcripts', false, 2000000, ARRAY['text/plain', 'text/vtt']),
  ('project-documents', 'project-documents', false, 15000000, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object paths always begin with project UUID: <project_id>/<file>.
DROP POLICY IF EXISTS project_files_read ON storage.objects;
DROP POLICY IF EXISTS project_files_insert ON storage.objects;
DROP POLICY IF EXISTS project_files_delete_monitor ON storage.objects;
CREATE POLICY project_files_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id IN ('project-transcripts', 'project-documents')
  AND public.can_access_project((storage.foldername(name))[1]::uuid)
);
CREATE POLICY project_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id IN ('project-transcripts', 'project-documents')
  AND public.can_access_project((storage.foldername(name))[1]::uuid)
  AND owner_id = auth.uid()::text
);
CREATE POLICY project_files_delete_monitor ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id IN ('project-transcripts', 'project-documents') AND public.is_superuser()
);

-- Keep every connected workspace current. Supabase still evaluates RLS before
-- delivering Postgres Changes, so each user only receives authorized rows.
DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'profiles', 'projects', 'project_applications', 'project_tasks',
    'project_issues', 'project_meetings', 'meeting_minutes',
    'document_templates', 'project_documents', 'project_activity'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
    END IF;
  END LOOP;
END $$;

COMMIT;
