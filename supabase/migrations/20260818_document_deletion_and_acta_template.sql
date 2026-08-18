-- Allow every authorized project member to remove a mistaken draft/document and
-- reset the official acta template so the verified client copy is re-registered.
BEGIN;

UPDATE public.document_templates
SET html_template = '',
    base_template_sha256 = '11f84c664a44d6f4a1f05b7eab5db529594fc931e0953ab00444bb1a0b5e5f2f',
    updated_at = now()
WHERE id = 'acta' AND document_type = 'acta_reunion';

DROP POLICY IF EXISTS documents_delete_project ON public.project_documents;
CREATE POLICY documents_delete_project ON public.project_documents FOR DELETE TO authenticated
  USING ((SELECT public.can_access_project(project_id)));

DROP POLICY IF EXISTS project_documents_delete_project ON storage.objects;
CREATE POLICY project_documents_delete_project ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND public.can_access_project((storage.foldername(name))[1]::uuid)
  );

COMMIT;
