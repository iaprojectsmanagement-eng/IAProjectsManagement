-- Operational workflows: tasks, incidents, meetings and generated documents.
-- Run after the existing schema and auth/RLS migrations.

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assignee_name TEXT NOT NULL DEFAULT 'Por asignar',
  due_date DATE,
  status TEXT NOT NULL CHECK (status IN ('pendiente', 'en_progreso', 'bloqueada', 'completada')) DEFAULT 'pendiente',
  priority TEXT NOT NULL CHECK (priority IN ('baja', 'media', 'alta', 'critica')) DEFAULT 'media',
  source TEXT NOT NULL CHECK (source IN ('manual', 'acta', 'incidencia')) DEFAULT 'manual',
  evidence_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tecnico', 'datos_accesos', 'comunicacion', 'equipo', 'recursos', 'otro')),
  priority TEXT NOT NULL CHECK (priority IN ('baja', 'media', 'alta', 'critica')) DEFAULT 'media',
  status TEXT NOT NULL CHECK (status IN ('abierta', 'en_revision', 'esperando_tercero', 'resuelta')) DEFAULT 'abierta',
  reported_by UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 15 AND 480),
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('programada', 'realizada', 'cancelada', 'no_realizada', 'reprogramada')) DEFAULT 'programada',
  cancellation_reason TEXT,
  google_event_id TEXT,
  calendar_sync_status TEXT NOT NULL CHECK (calendar_sync_status IN ('pendiente', 'simulado', 'sincronizado', 'error')) DEFAULT 'pendiente',
  minute_id UUID REFERENCES meeting_minutes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('seguimiento', 'requerimientos', 'entrega')),
  html_template TEXT NOT NULL,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES document_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('borrador', 'en_revision', 'aprobado')) DEFAULT 'borrador',
  version INTEGER NOT NULL DEFAULT 1,
  html_content TEXT NOT NULL,
  file_url TEXT,
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('tarea', 'incidencia', 'reunion', 'documento', 'equipo')),
  message TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_tasks_open_by_project ON project_tasks(project_id, status, due_date);
CREATE INDEX IF NOT EXISTS project_issues_open_by_project ON project_issues(project_id, status, priority);
CREATE INDEX IF NOT EXISTS project_meetings_by_date ON project_meetings(starts_at, status);
CREATE INDEX IF NOT EXISTS project_activity_by_project ON project_activity(project_id, created_at DESC);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_tasks_read ON project_tasks FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY operational_tasks_insert ON project_tasks FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id));
CREATE POLICY operational_tasks_update ON project_tasks FOR UPDATE TO authenticated USING (public.can_access_project(project_id)) WITH CHECK (public.can_access_project(project_id));
CREATE POLICY operational_issues_read ON project_issues FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY operational_issues_insert ON project_issues FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id) AND reported_by = auth.uid());
CREATE POLICY operational_issues_update ON project_issues FOR UPDATE TO authenticated USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY operational_meetings_read ON project_meetings FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY operational_meetings_write ON project_meetings FOR ALL TO authenticated USING (public.can_access_project(project_id)) WITH CHECK (public.can_access_project(project_id));
CREATE POLICY templates_read ON document_templates FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY templates_manage ON document_templates FOR ALL TO authenticated USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY documents_read ON project_documents FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY documents_write ON project_documents FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id));
CREATE POLICY documents_manage ON project_documents FOR UPDATE TO authenticated USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY activity_read ON project_activity FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY activity_insert ON project_activity FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id));

INSERT INTO document_templates (id, name, description, category, html_template, required_fields)
VALUES
  ('acta', 'Acta de reunión', 'Decisiones, compromisos, riesgos y próximos pasos.', 'seguimiento', '<article><h1>Acta de reunión</h1><p>{{project_title}}</p><h2>Decisiones</h2>{{decisions}}<h2>Compromisos</h2>{{commitments}}</article>', '["fecha", "asistentes", "decisiones", "compromisos"]'),
  ('requerimientos', 'Levantamiento de requerimientos', 'Problema, usuarios, alcance y criterios.', 'requerimientos', '<article><h1>Levantamiento de requerimientos</h1><p>{{project_title}}</p><h2>Problema</h2>{{problem}}<h2>Alcance</h2>{{scope}}</article>', '["problema", "usuarios", "alcance", "criterios"]'),
  ('informe-semanal', 'Informe semanal', 'Avances, bloqueos y próximos pasos.', 'seguimiento', '<article><h1>Informe semanal</h1><p>{{project_title}}</p><h2>Avances</h2>{{progress}}<h2>Bloqueos</h2>{{blockers}}</article>', '["avances", "bloqueos", "proximos_pasos"]')
ON CONFLICT (id) DO NOTHING;
