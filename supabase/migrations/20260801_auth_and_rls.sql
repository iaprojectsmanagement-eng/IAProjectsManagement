-- Authentication profile bootstrap and row-level access controls.
-- All new users start as students; elevated roles are assigned only by an administrator.

CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'superuser'
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
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND project_id = target_project_id
    );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, student_code, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'student_code', ''),
    'student_group'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      student_code = COALESCE(EXCLUDED.student_code, public.profiles.student_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

ALTER TABLE project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superuser_all_projects ON projects;
DROP POLICY IF EXISTS student_view_assigned_project ON projects;
DROP POLICY IF EXISTS superuser_all_minutes ON meeting_minutes;
DROP POLICY IF EXISTS authenticated_read_projects ON projects;
DROP POLICY IF EXISTS superuser_manage_projects ON projects;
DROP POLICY IF EXISTS own_or_superuser_read_profiles ON profiles;
DROP POLICY IF EXISTS superuser_manage_profiles ON profiles;
DROP POLICY IF EXISTS own_or_superuser_read_applications ON project_applications;
DROP POLICY IF EXISTS student_create_applications ON project_applications;
DROP POLICY IF EXISTS superuser_manage_applications ON project_applications;
DROP POLICY IF EXISTS project_members_read_minutes ON meeting_minutes;
DROP POLICY IF EXISTS project_members_create_minutes ON meeting_minutes;
DROP POLICY IF EXISTS superuser_manage_minutes ON meeting_minutes;
DROP POLICY IF EXISTS project_members_read_messages ON project_messages;
DROP POLICY IF EXISTS students_create_messages ON project_messages;
DROP POLICY IF EXISTS superusers_create_messages ON project_messages;
DROP POLICY IF EXISTS superuser_manage_messages ON project_messages;
DROP POLICY IF EXISTS project_members_read_alerts ON alerts;
DROP POLICY IF EXISTS project_members_create_alerts ON alerts;
DROP POLICY IF EXISTS superuser_manage_alerts ON alerts;

CREATE POLICY authenticated_read_projects ON projects
  FOR SELECT TO authenticated
  USING (public.is_superuser() OR public.can_access_project(id));
CREATE POLICY superuser_manage_projects ON projects
  FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

CREATE POLICY own_or_superuser_read_profiles ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_superuser());
CREATE POLICY superuser_manage_profiles ON profiles
  FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

CREATE POLICY own_or_superuser_read_applications ON project_applications
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_superuser());
CREATE POLICY student_create_applications ON project_applications
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND status = 'pendiente');
CREATE POLICY superuser_manage_applications ON project_applications
  FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

CREATE POLICY project_members_read_minutes ON meeting_minutes
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));
CREATE POLICY project_members_create_minutes ON meeting_minutes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project(project_id) AND uploaded_by = auth.uid());
CREATE POLICY superuser_manage_minutes ON meeting_minutes
  FOR UPDATE TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY superuser_delete_minutes ON meeting_minutes
  FOR DELETE TO authenticated USING (public.is_superuser());

CREATE POLICY project_members_read_messages ON project_messages
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));
CREATE POLICY students_create_messages ON project_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND sender_id = auth.uid()
    AND sender_role = 'student'
  );
CREATE POLICY superusers_create_messages ON project_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superuser()
    AND sender_id = auth.uid()
    AND sender_role = 'superuser'
  );
CREATE POLICY superuser_manage_messages ON project_messages
  FOR UPDATE TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY superuser_delete_messages ON project_messages
  FOR DELETE TO authenticated USING (public.is_superuser());

CREATE POLICY project_members_read_alerts ON alerts
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));
CREATE POLICY project_members_create_alerts ON alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND reported_by = auth.uid()
  );
CREATE POLICY superuser_manage_alerts ON alerts
  FOR UPDATE TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());
CREATE POLICY superuser_delete_alerts ON alerts
  FOR DELETE TO authenticated USING (public.is_superuser());
