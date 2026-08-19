-- Remove implicit anonymous execution from privileged RPCs already deployed.
BEGIN;

REVOKE ALL ON FUNCTION public.claim_password_login_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_password_login_attempt(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.set_project_links(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_links(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
