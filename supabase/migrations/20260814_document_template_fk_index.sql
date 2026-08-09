-- Cover the remaining document foreign key reported by the database advisor.
CREATE INDEX IF NOT EXISTS project_documents_template_id_idx
  ON public.project_documents(template_id);
