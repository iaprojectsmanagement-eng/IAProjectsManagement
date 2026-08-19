-- Server-enforced AI budgets and private operational incidents for management.
-- Request contents are never persisted: only actor, project, rule and timestamp.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_limit_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  limit_window TEXT NOT NULL CHECK (limit_window IN ('minute', 'hour', 'day')),
  operation TEXT NOT NULL CHECK (operation IN ('transcript', 'document')),
  status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'archivada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_limit_incidents_open_created_idx
  ON public.ai_limit_incidents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_limit_incidents_actor_created_idx
  ON public.ai_limit_incidents(actor_id, created_at DESC);
ALTER TABLE public.ai_limit_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_limit_incidents_read_management ON public.ai_limit_incidents
  FOR SELECT TO authenticated USING ((SELECT public.is_superuser()));
CREATE POLICY ai_limit_incidents_update_management ON public.ai_limit_incidents
  FOR UPDATE TO authenticated USING ((SELECT public.is_superuser()))
  WITH CHECK ((SELECT public.is_superuser()));
CREATE POLICY ai_limit_incidents_delete_management ON public.ai_limit_incidents
  FOR DELETE TO authenticated USING ((SELECT public.is_superuser()));

DROP FUNCTION IF EXISTS public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER);
CREATE FUNCTION public.claim_ai_request(
  target_project_id UUID,
  target_operation TEXT,
  target_provider TEXT,
  target_model TEXT,
  target_input_chars INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  request_id UUID;
  used_calls INTEGER;
  exceeded_window TEXT;
BEGIN
  IF actor IS NULL OR NOT public.can_access_project(target_project_id) THEN
    RAISE EXCEPTION 'AI_ACCESS_DENIED';
  END IF;
  IF target_operation NOT IN ('transcript', 'document') OR target_provider NOT IN ('openai', 'gemini') THEN
    RAISE EXCEPTION 'AI_INVALID_OPERATION';
  END IF;

  -- Serialise claims by actor so parallel browser requests cannot all pass a
  -- count check before any of them writes its usage row.
  PERFORM pg_advisory_xact_lock(hashtext(actor::text));

  SELECT count(*) INTO used_calls FROM public.ai_usage_log
    WHERE user_id = actor AND created_at >= now() - interval '1 minute';
  IF used_calls >= 3 THEN exceeded_window := 'minute'; END IF;
  IF exceeded_window IS NULL THEN
    SELECT count(*) INTO used_calls FROM public.ai_usage_log
      WHERE user_id = actor AND created_at >= now() - interval '1 hour';
    IF used_calls >= 10 THEN exceeded_window := 'hour'; END IF;
  END IF;
  IF exceeded_window IS NULL THEN
    SELECT count(*) INTO used_calls FROM public.ai_usage_log
      WHERE user_id = actor AND created_at >= now() - interval '1 day';
    IF used_calls >= 20 THEN exceeded_window := 'day'; END IF;
  END IF;

  IF exceeded_window IS NOT NULL THEN
    INSERT INTO public.ai_limit_incidents(actor_id, project_id, limit_window, operation)
      VALUES (actor, target_project_id, exceeded_window, target_operation);
    RETURN jsonb_build_object('quota', exceeded_window);
  END IF;

  INSERT INTO public.ai_usage_log(user_id, project_id, operation, provider, model, input_chars)
    VALUES (actor, target_project_id, target_operation, target_provider, target_model, greatest(target_input_chars, 0))
    RETURNING id INTO request_id;
  RETURN jsonb_build_object('requestId', request_id);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ai_request(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- Sources and transcripts cannot be removed through the application API in
-- their first year. Supabase lifecycle rules remain an external deployment
-- setting and must not be configured with a shorter retention period.
DROP POLICY IF EXISTS project_files_delete_monitor ON storage.objects;
CREATE POLICY project_files_delete_monitor ON storage.objects FOR DELETE TO authenticated USING (
  (SELECT public.is_superuser())
  AND (
    bucket_id = 'project-documents'
    OR (bucket_id IN ('project-transcripts', 'project-source-files') AND created_at <= now() - interval '1 year')
  )
);

COMMIT;
