-- Close implicit function grants and define company visibility explicitly.
BEGIN;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Trigger/event functions are never public RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- Deliberately exposed authenticated RPC/helpers. Every SECURITY DEFINER body
-- validates auth.uid(), project access or the monitor role before reading/writing.
GRANT EXECUTE ON FUNCTION public.is_superuser() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_profile_visible(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_to_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_student_from_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_available_projects() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ai_request(UUID, TEXT, INTEGER, TEXT) TO authenticated;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companies_read_authorized ON public.companies;
DROP POLICY IF EXISTS companies_manage_monitor ON public.companies;
CREATE POLICY companies_read_authorized ON public.companies FOR SELECT TO authenticated
  USING (
    public.is_superuser()
    OR EXISTS (
      SELECT 1
      FROM public.projects project
      JOIN public.profiles profile ON profile.project_id = project.id
      WHERE project.company_id = companies.id AND profile.id = (SELECT auth.uid())
    )
  );
CREATE POLICY companies_manage_monitor ON public.companies FOR ALL TO authenticated
  USING (public.is_superuser()) WITH CHECK (public.is_superuser());

COMMIT;
