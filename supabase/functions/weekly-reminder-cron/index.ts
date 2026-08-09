import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = { "Content-Type": "application/json; charset=utf-8" };
serve(async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405, headers });
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers });
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-follow-up`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, "x-cron-secret": cronSecret },
  });
  return new Response(await response.text(), { status: response.status, headers });
});
