-- Per-user AI request budgets. No transcript or prompt content is retained.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('transcript', 'document')),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini')),
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')) DEFAULT 'started',
  input_chars INTEGER NOT NULL DEFAULT 0 CHECK (input_chars >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_usage_user_created ON public.ai_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_project_created ON public.ai_usage_log(project_id, created_at DESC);
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_read_own_or_monitor ON public.ai_usage_log;
CREATE POLICY ai_usage_read_own_or_monitor ON public.ai_usage_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superuser());

CREATE OR REPLACE FUNCTION public.claim_ai_request(
  target_project_id UUID,
  target_operation TEXT,
  target_provider TEXT,
  target_model TEXT,
  target_input_chars INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  request_id UUID;
BEGIN
  IF actor IS NULL OR NOT public.can_access_project(target_project_id) THEN
    RAISE EXCEPTION 'AI_ACCESS_DENIED';
  END IF;
  IF target_operation NOT IN ('transcript', 'document') OR target_provider NOT IN ('openai', 'gemini') THEN
    RAISE EXCEPTION 'AI_INVALID_OPERATION';
  END IF;
  IF (SELECT count(*) FROM public.ai_usage_log WHERE user_id = actor AND created_at >= now() - interval '1 minute') >= 2 THEN
    RAISE EXCEPTION 'AI_QUOTA_MINUTE';
  END IF;
  IF (SELECT count(*) FROM public.ai_usage_log WHERE user_id = actor AND created_at >= now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'AI_QUOTA_HOUR';
  END IF;
  IF (SELECT count(*) FROM public.ai_usage_log WHERE user_id = actor AND created_at >= now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'AI_QUOTA_DAY';
  END IF;
  INSERT INTO public.ai_usage_log(user_id, project_id, operation, provider, model, input_chars)
    VALUES (actor, target_project_id, target_operation, target_provider, target_model, greatest(target_input_chars, 0))
    RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_ai_request(
  target_request_id UUID,
  target_status TEXT,
  target_output_tokens INTEGER DEFAULT 0,
  target_error_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_status NOT IN ('succeeded', 'failed') THEN RAISE EXCEPTION 'AI_INVALID_STATUS'; END IF;
  UPDATE public.ai_usage_log
    SET status = target_status,
        output_tokens = greatest(target_output_tokens, 0),
        error_code = left(target_error_code, 100),
        completed_at = now()
    WHERE id = target_request_id AND user_id = auth.uid() AND status = 'started';
END;
$$;
REVOKE ALL ON FUNCTION public.finish_ai_request(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_ai_request(UUID, TEXT, INTEGER, TEXT) TO authenticated;

COMMIT;
