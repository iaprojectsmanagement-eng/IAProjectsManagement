BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.project_meetings ADD COLUMN IF NOT EXISTS meeting_url TEXT, ADD COLUMN IF NOT EXISTS meeting_password TEXT;
CREATE OR REPLACE FUNCTION public.validate_meeting_change() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'realizada' THEN RAISE EXCEPTION 'Una reunión realizada no puede cambiar de estado'; END IF;
  IF OLD.status IN ('cancelada', 'no_realizada') AND NEW.status <> 'reprogramada' THEN RAISE EXCEPTION 'Una reunión cancelada o no realizada solo puede reprogramarse'; END IF;
  RETURN NEW;
END;
$$;
COMMIT;
