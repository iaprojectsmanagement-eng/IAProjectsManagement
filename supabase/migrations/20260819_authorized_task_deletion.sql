-- Team members can remove obsolete tasks from their own project. RLS keeps
-- cross-project tasks inaccessible and therefore undeletable.
BEGIN;

DROP POLICY IF EXISTS tasks_delete_monitor ON public.project_tasks;
CREATE POLICY tasks_delete_project ON public.project_tasks FOR DELETE TO authenticated
  USING ((SELECT public.can_access_project(project_id)));

COMMIT;
