-- 1. Empresas u Organizaciones del Ecosistema (ej: Coomeva CEM, INSIGHT PMO, Fiducoomeva, etc.)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Proyectos (Con todos los atributos de caracterización técnica, financiera e impacto)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  folder_name TEXT UNIQUE NOT NULL, -- ej: '3_CEM', '6_PMO', '16_WinBack'
  group_name TEXT,
  title TEXT NOT NULL,
  challenge_description TEXT,
  whatsapp_url TEXT,
  teams_meeting_url TEXT,
  
  -- Configuración de Integrantes
  min_students INTEGER DEFAULT 2,
  max_students INTEGER DEFAULT 5,
  
  -- Estado y Métricas de Progreso
  progress_status TEXT DEFAULT 'En Progreso',
  progress_pct INTEGER DEFAULT 0,
  risk_level TEXT CHECK (risk_level IN ('verde', 'amarillo', 'rojo')) DEFAULT 'verde',
  
  -- Integrantes de la Organización
  organization_contacts JSONB DEFAULT '[]'::jsonb,
  
  -- Caracterización del Proyecto de IA
  ai_type TEXT[],
  cop_impact_description TEXT,
  cop_impact_annual NUMERIC DEFAULT 0,
  impact_rating INTEGER CHECK (impact_rating BETWEEN 1 AND 10),
  complexity_rating INTEGER CHECK (complexity_rating BETWEEN 1 AND 10),
  ai_risks TEXT,
  required_datasets TEXT,
  data_quality_availability TEXT,
  tech_viability TEXT,
  
  -- Enlaces a Entregables y Recursos
  github_url TEXT,
  drive_folder_url TEXT,
  video_url TEXT,
  ppt_url TEXT,
  final_report_url TEXT,
  baseline_doc_url TEXT,
  
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Perfiles de Usuarios (Superuser Monitor, Estudiantes, Contactos Empresa)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  student_code TEXT,
  role TEXT CHECK (role IN ('superuser', 'student_group', 'company_contact')) DEFAULT 'student_group',
  allow_multiple_projects BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Postulaciones a Proyectos (Fase de selección)
CREATE TABLE IF NOT EXISTS project_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pendiente', 'aceptada', 'rechazada')) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, student_id)
);

-- 5. Chat Híbrido del Proyecto (Estudiantes, IA y Monitor)
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT CHECK (sender_role IN ('student', 'ai', 'superuser')) NOT NULL,
  message TEXT NOT NULL,
  is_ai_consultation BOOLEAN DEFAULT FALSE,
  is_read_by_monitor BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Actas de Reunión y Transcripciones
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  transcript_file_url TEXT,
  summary TEXT,
  decisions JSONB DEFAULT '[]'::jsonb,
  commitments JSONB DEFAULT '[]'::jsonb,
  risks_detected TEXT,
  sentiment TEXT,
  doc_file_url TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Alertas e Inconvenientes
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requested_resources TEXT,
  severity TEXT CHECK (severity IN ('baja', 'media', 'alta', 'critica')) DEFAULT 'media',
  status TEXT CHECK (status IN ('abierta', 'en_proceso', 'resuelta')) DEFAULT 'abierta',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Superuser puede hacer todo
CREATE POLICY superuser_all_projects ON projects FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superuser')
);

CREATE POLICY superuser_all_minutes ON meeting_minutes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superuser')
);

-- Estudiantes ven su proyecto asignado
CREATE POLICY student_view_assigned_project ON projects FOR SELECT TO authenticated USING (
  id = (SELECT project_id FROM profiles WHERE id = auth.uid())
);
