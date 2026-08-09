-- Advisor follow-up for the institutional document workflow.
CREATE INDEX IF NOT EXISTS project_document_versions_created_by_idx
  ON public.project_document_versions(created_by);
CREATE INDEX IF NOT EXISTS project_documents_generated_by_idx
  ON public.project_documents(generated_by);
CREATE INDEX IF NOT EXISTS project_documents_approved_by_idx
  ON public.project_documents(approved_by);

DROP POLICY IF EXISTS documents_read_project ON public.project_documents;
CREATE POLICY documents_read_project ON public.project_documents FOR SELECT TO authenticated
USING ((SELECT public.can_access_project(project_id)));

DROP POLICY IF EXISTS documents_create_project ON public.project_documents;
CREATE POLICY documents_create_project ON public.project_documents FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.can_access_project(project_id))
  AND generated_by = (SELECT auth.uid())
  AND status = 'borrador'
);

DROP POLICY IF EXISTS documents_delete_monitor ON public.project_documents;
CREATE POLICY documents_delete_monitor ON public.project_documents FOR DELETE TO authenticated
USING ((SELECT public.is_superuser()));

DROP POLICY IF EXISTS documents_update_monitor ON public.project_documents;
DROP POLICY IF EXISTS documents_update_project_draft ON public.project_documents;
CREATE POLICY documents_update_authorized ON public.project_documents FOR UPDATE TO authenticated
USING (
  (SELECT public.is_superuser())
  OR ((SELECT public.can_access_project(project_id)) AND status <> 'aprobado')
)
WITH CHECK (
  (SELECT public.is_superuser())
  OR ((SELECT public.can_access_project(project_id)) AND status <> 'aprobado')
);
