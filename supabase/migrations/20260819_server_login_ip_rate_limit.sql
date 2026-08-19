-- Server-side password-login abuse control. The function is only executed by
-- the unauthenticated login Edge Function using the service-role key.
BEGIN;

CREATE TABLE IF NOT EXISTS public.login_ip_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.login_ip_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_password_login_attempt(target_ip_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_limit public.login_ip_rate_limits;
BEGIN
  IF target_ip_hash IS NULL OR length(target_ip_hash) <> 64 OR target_ip_hash !~ '^[0-9a-f]+$' THEN
    RAISE EXCEPTION 'LOGIN_RATE_LIMIT_INVALID_KEY';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(target_ip_hash));
  SELECT * INTO current_limit
  FROM public.login_ip_rate_limits
  WHERE ip_hash = target_ip_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.login_ip_rate_limits(ip_hash, attempts) VALUES (target_ip_hash, 1);
    RETURN jsonb_build_object('allowed', true, 'remaining', 9);
  END IF;

  IF current_limit.window_started_at <= now() - interval '5 minutes' THEN
    UPDATE public.login_ip_rate_limits
    SET window_started_at = now(), attempts = 1, updated_at = now()
    WHERE ip_hash = target_ip_hash;
    RETURN jsonb_build_object('allowed', true, 'remaining', 9);
  END IF;

  IF current_limit.attempts >= 10 THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  UPDATE public.login_ip_rate_limits
  SET attempts = attempts + 1, updated_at = now()
  WHERE ip_hash = target_ip_hash;
  RETURN jsonb_build_object('allowed', true, 'remaining', 9 - current_limit.attempts);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_password_login_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_password_login_attempt(TEXT) TO service_role;

COMMIT;
