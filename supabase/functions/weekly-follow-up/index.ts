import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || request.headers.get("x-cron-secret") !== expectedSecret) return json({ error: "No autorizado" }, 401);
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: overdueTasks, error: taskError }, { data: openIssues, error: issueError }, { data: minutesPending, error: meetingError }] = await Promise.all([
      supabase.from("project_tasks").select("id, project_id, title, due_date").neq("status", "completada").lt("due_date", today),
      supabase.from("project_issues").select("id, project_id, title, priority").neq("status", "resuelta").in("priority", ["alta", "critica"]),
      supabase.from("project_meetings").select("id, project_id, title").eq("status", "realizada").is("minute_id", null),
    ]);
    if (taskError || issueError || meetingError) throw taskError || issueError || meetingError;
    const summary = { overdueTasks: overdueTasks?.length || 0, highPriorityIssues: openIssues?.length || 0, minutesPending: minutesPending?.length || 0 };
    const webhook = Deno.env.get("FOLLOW_UP_WEBHOOK_URL");
    if (webhook) {
      const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "weekly_follow_up", summary, overdueTasks, openIssues, minutesPending, generatedAt: new Date().toISOString() }) });
      if (!response.ok) throw new Error(`El webhook de seguimiento respondió ${response.status}`);
    }
    return json({ mode: webhook ? "notificado" : "simulado", summary });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error inesperado" }, 500);
  }
});
