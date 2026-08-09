-- Institutional document workflow: four official templates, immutable versions,
-- private source files and atomic AI generation/revision persistence.
BEGIN;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS base_template_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS original_docx_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_templates_document_type_check' AND conrelid = 'public.document_templates'::regclass) THEN
    ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_document_type_check
      CHECK (document_type IS NULL OR document_type IN ('contexto_proyecto', 'plan_actividades', 'acta_reunion', 'reporte_entregables'));
  END IF;
END $$;

UPDATE public.document_templates SET is_active = false WHERE id IN ('requerimientos', 'informe-semanal');

INSERT INTO public.document_templates
  (id, name, description, category, html_template, required_fields, is_active, version, document_type, base_template_sha256, original_docx_name)
VALUES
  ('contexto-proyecto', 'Contexto del proyecto', 'Problema, oportunidad de IA, objetivos, alcance, restricciones y equipo.', 'requerimientos', '', '["problema","oportunidad_ia","objetivos","alcance","restricciones"]', true, 1, 'contexto_proyecto', '00365211c7d1c5d0afb9b2d0cd34cedec7d14cf8941103cd551f83b7ec91e328', '01. Contexto del Proyecto.docx'),
  ('plan-actividades', 'Plan de actividades', 'Actividades, responsables, fechas, hitos y riesgos del proyecto.', 'seguimiento', '', '["actividades","responsables","fechas","hitos","riesgos"]', true, 1, 'plan_actividades', 'b1667448c4d61b2ff61fcc8d66e56d6483dcf3109e8cc6ebf8a028b1a2a65ab0', '02.Plan de Actividades.docx'),
  ('acta', 'Acta de reunión', 'Datos, asistentes, agenda, decisiones, pendientes y compromisos.', 'seguimiento', '', '["transcripcion","fecha","asistentes","decisiones","compromisos"]', true, 1, 'acta_reunion', 'aa928f827dc30ff3bb11d0037cc38627c2e70a1a9c7ab5498215fa1d96fd9e3c', '03.Acta de Reunion.docx'),
  ('reporte-entregables', 'Reporte de entregables', 'Avance, hitos, entregables, resultados, bloqueos y próximos pasos.', 'entrega', '', '["avance","hitos","entregables","resultados","bloqueos"]', true, 1, 'reporte_entregables', 'c6df020f459e3f4eb65a605f72859569bb81ba338f9c88203ac5cafee16376d8', '04.Reporte de Entregables.docx')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  html_template = CASE WHEN public.document_templates.document_type IS NULL THEN EXCLUDED.html_template ELSE public.document_templates.html_template END,
  required_fields = EXCLUDED.required_fields,
  is_active = true,
  document_type = EXCLUDED.document_type,
  base_template_sha256 = EXCLUDED.base_template_sha256,
  original_docx_name = EXCLUDED.original_docx_name,
  updated_at = now();

ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'pdf_pendiente',
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'template',
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS source_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS last_change_request TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_document_type_check' AND conrelid = 'public.project_documents'::regclass) THEN
    ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_document_type_check
      CHECK (document_type IS NULL OR document_type IN ('contexto_proyecto', 'plan_actividades', 'acta_reunion', 'reporte_entregables'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_generation_status_check' AND conrelid = 'public.project_documents'::regclass) THEN
    ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_generation_status_check
      CHECK (generation_status IN ('generando', 'pdf_pendiente', 'listo', 'error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_provider_check' AND conrelid = 'public.project_documents'::regclass) THEN
    ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_provider_check
      CHECK (provider IN ('openai', 'template', 'local'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_source_files_check' AND conrelid = 'public.project_documents'::regclass) THEN
    ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_source_files_check
      CHECK (jsonb_typeof(source_files) = 'array');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  pdf_storage_path TEXT,
  source_files JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_files) = 'array'),
  change_request TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'template', 'local')),
  model TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS project_documents_project_updated_idx ON public.project_documents(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS project_document_versions_document_version_idx ON public.project_document_versions(document_id, version DESC);
CREATE INDEX IF NOT EXISTS project_document_versions_project_created_idx ON public.project_document_versions(project_id, created_at DESC);

ALTER TABLE public.project_document_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_versions_read_project ON public.project_document_versions;
CREATE POLICY document_versions_read_project ON public.project_document_versions FOR SELECT TO authenticated
  USING ((SELECT public.can_access_project(project_id)));

DROP POLICY IF EXISTS documents_update_creator_draft ON public.project_documents;
DROP POLICY IF EXISTS documents_update_project_draft ON public.project_documents;
CREATE POLICY documents_update_project_draft ON public.project_documents FOR UPDATE TO authenticated
  USING ((SELECT public.can_access_project(project_id)) AND status <> 'aprobado')
  WITH CHECK ((SELECT public.can_access_project(project_id)) AND status <> 'aprobado');

CREATE OR REPLACE FUNCTION public.create_generated_document(
  target_document_id UUID,
  target_project_id UUID,
  target_template_id TEXT,
  target_document_type TEXT,
  target_title TEXT,
  target_html TEXT,
  target_source_files JSONB,
  target_provider TEXT,
  target_model TEXT DEFAULT NULL
)
RETURNS TABLE(document_row JSONB, version_row JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor UUID := auth.uid();
  saved_document public.project_documents%ROWTYPE;
  saved_version public.project_document_versions%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT public.can_access_project(target_project_id) THEN RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED'; END IF;
  IF target_document_id IS NULL OR EXISTS (SELECT 1 FROM public.project_documents WHERE id = target_document_id) THEN RAISE EXCEPTION 'DOCUMENT_ID_INVALID'; END IF;
  IF length(trim(target_title)) NOT BETWEEN 1 AND 240 OR length(target_html) NOT BETWEEN 100 AND 500000 THEN RAISE EXCEPTION 'DOCUMENT_CONTENT_INVALID'; END IF;
  IF target_provider NOT IN ('openai', 'template', 'local') OR jsonb_typeof(COALESCE(target_source_files, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'DOCUMENT_METADATA_INVALID'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.document_templates
    WHERE id = target_template_id AND document_type = target_document_type AND is_active
  ) THEN RAISE EXCEPTION 'DOCUMENT_TEMPLATE_INVALID'; END IF;

  INSERT INTO public.project_documents
    (id, project_id, template_id, document_type, title, status, version, html_content, generated_by, generation_status, provider, model, source_files)
  VALUES
    (target_document_id, target_project_id, target_template_id, target_document_type, trim(target_title), 'borrador', 1, target_html, actor, 'pdf_pendiente', target_provider, target_model, COALESCE(target_source_files, '[]'::jsonb))
  RETURNING * INTO saved_document;

  INSERT INTO public.project_document_versions
    (document_id, project_id, version, title, html_content, source_files, provider, model, created_by)
  VALUES
    (saved_document.id, saved_document.project_id, 1, saved_document.title, saved_document.html_content, saved_document.source_files, saved_document.provider, saved_document.model, actor)
  RETURNING * INTO saved_version;

  RETURN QUERY SELECT to_jsonb(saved_document), to_jsonb(saved_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_document_revision(
  target_document_id UUID,
  target_title TEXT,
  target_html TEXT,
  target_change_request TEXT,
  target_provider TEXT,
  target_model TEXT DEFAULT NULL
)
RETURNS TABLE(document_row JSONB, version_row JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor UUID := auth.uid();
  current_document public.project_documents%ROWTYPE;
  saved_document public.project_documents%ROWTYPE;
  saved_version public.project_document_versions%ROWTYPE;
  next_version INTEGER;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED'; END IF;
  SELECT * INTO current_document FROM public.project_documents WHERE id = target_document_id FOR UPDATE;
  IF current_document.id IS NULL OR NOT public.can_access_project(current_document.project_id) THEN RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED'; END IF;
  IF current_document.status = 'aprobado' THEN RAISE EXCEPTION 'DOCUMENT_APPROVED_LOCKED'; END IF;
  IF length(trim(target_title)) NOT BETWEEN 1 AND 240 OR length(target_html) NOT BETWEEN 100 AND 500000 THEN RAISE EXCEPTION 'DOCUMENT_CONTENT_INVALID'; END IF;
  IF length(trim(target_change_request)) NOT BETWEEN 3 AND 2000 OR target_provider NOT IN ('openai', 'template', 'local') THEN RAISE EXCEPTION 'DOCUMENT_REVISION_INVALID'; END IF;
  next_version := current_document.version + 1;

  UPDATE public.project_documents SET
    title = trim(target_title), version = next_version, html_content = target_html,
    generation_status = 'pdf_pendiente', provider = target_provider, model = target_model,
    last_change_request = trim(target_change_request), pdf_storage_path = NULL,
    storage_path = NULL, updated_at = now()
  WHERE id = target_document_id
  RETURNING * INTO saved_document;

  INSERT INTO public.project_document_versions
    (document_id, project_id, version, title, html_content, source_files, change_request, provider, model, created_by)
  VALUES
    (saved_document.id, saved_document.project_id, next_version, saved_document.title, saved_document.html_content, saved_document.source_files, trim(target_change_request), saved_document.provider, saved_document.model, actor)
  RETURNING * INTO saved_version;

  RETURN QUERY SELECT to_jsonb(saved_document), to_jsonb(saved_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_document_pdf(
  target_document_id UUID,
  target_version INTEGER,
  target_storage_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor UUID := auth.uid();
  current_document public.project_documents%ROWTYPE;
BEGIN
  SELECT * INTO current_document FROM public.project_documents WHERE id = target_document_id;
  IF actor IS NULL OR current_document.id IS NULL OR NOT public.can_access_project(current_document.project_id) THEN RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED'; END IF;
  IF target_version < 1 OR target_storage_path !~ ('^' || current_document.project_id::text || '/' || current_document.id::text || '/.+[.]pdf$') THEN RAISE EXCEPTION 'DOCUMENT_PATH_INVALID'; END IF;
  UPDATE public.project_document_versions SET pdf_storage_path = target_storage_path
    WHERE document_id = target_document_id AND version = target_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_VERSION_NOT_FOUND'; END IF;
  IF current_document.version = target_version THEN
    UPDATE public.project_documents SET pdf_storage_path = target_storage_path, storage_path = target_storage_path, generation_status = 'listo', updated_at = now()
      WHERE id = target_document_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_generated_document(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_document_revision(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attach_document_pdf(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_generated_document(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_document_revision(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_document_pdf(UUID, INTEGER, TEXT) TO authenticated;

GRANT SELECT ON public.project_document_versions TO authenticated;
REVOKE ALL ON public.project_document_versions FROM anon;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-source-files', 'project-source-files', false, 15000000, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/vtt'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS project_files_read ON storage.objects;
DROP POLICY IF EXISTS project_files_insert ON storage.objects;
DROP POLICY IF EXISTS project_files_delete_monitor ON storage.objects;
CREATE POLICY project_files_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id IN ('project-transcripts', 'project-documents', 'project-source-files')
  AND (SELECT public.can_access_project((storage.foldername(name))[1]::uuid))
);
CREATE POLICY project_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id IN ('project-transcripts', 'project-documents', 'project-source-files')
  AND (SELECT public.can_access_project((storage.foldername(name))[1]::uuid))
  AND owner_id = (SELECT auth.uid())::text
);
CREATE POLICY project_files_delete_monitor ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id IN ('project-transcripts', 'project-documents', 'project-source-files') AND (SELECT public.is_superuser())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_document_versions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_document_versions;
  END IF;
END $$;

COMMIT;
