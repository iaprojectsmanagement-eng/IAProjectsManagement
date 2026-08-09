import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Autenticación requerida" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Sesión inválida o vencida" }, 401);
    const { meetingId, action = "upsert" } = await request.json();
    if (!meetingId || !["upsert", "cancel"].includes(action)) return json({ error: "meetingId y una acción válida son obligatorios" }, 400);
    const { data: meeting, error } = await supabase.from("project_meetings").select("*, projects(title)").eq("id", meetingId).single();
    if (error || !meeting) return json({ error: "Reunión no encontrada o sin acceso" }, 404);

    // A per-user OAuth token should replace this secret in production. Until
    // that integration is configured, the same validated flow remains simulated.
    const accessToken = Deno.env.get("GOOGLE_CALENDAR_ACCESS_TOKEN");
    if (!accessToken) {
      await supabase.from("project_meetings").update({ calendar_sync_status: "simulado" }).eq("id", meetingId);
      return json({ mode: "simulado", action, meetingId, message: "Configura OAuth de Google Calendar para sincronizar eventos reales." });
    }

    const eventId = meeting.google_event_id ? encodeURIComponent(meeting.google_event_id) : "";
    const endpoint = action === "cancel" && eventId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events${eventId ? `/${eventId}` : ""}`;
    const method = action === "cancel" ? "DELETE" : eventId ? "PUT" : "POST";
    if (action === "cancel" && !eventId) return json({ error: "La reunión no tiene un evento de Google asociado" }, 409);
    const end = new Date(new Date(meeting.starts_at).getTime() + meeting.duration_minutes * 60_000).toISOString();
    const attendees = Array.isArray(meeting.attendees) ? meeting.attendees.filter((email: unknown) => typeof email === "string" && String(email).includes("@")).map((email: string) => ({ email })) : [];
    const response = await fetch(endpoint, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify({
        summary: meeting.title,
        description: `${meeting.agenda || ""}\n\nProyecto: ${meeting.projects?.title || ""}`.trim(),
        start: { dateTime: meeting.starts_at, timeZone: meeting.timezone || "America/Bogota" },
        end: { dateTime: end, timeZone: meeting.timezone || "America/Bogota" },
        attendees,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error("Google Calendar error", response.status, detail);
      await supabase.from("project_meetings").update({ calendar_sync_status: "error" }).eq("id", meetingId);
      return json({ error: "Google Calendar rechazó la sincronización" }, 502);
    }
    const event = method === "DELETE" ? null : await response.json();
    const patch = action === "cancel"
      ? { calendar_sync_status: "sincronizado", calendar_event_url: null }
      : { google_event_id: event?.id ?? meeting.google_event_id, calendar_sync_status: "sincronizado", calendar_event_url: event?.htmlLink ?? meeting.calendar_event_url };
    const { error: updateError } = await supabase.from("project_meetings").update(patch).eq("id", meetingId);
    if (updateError) throw updateError;
    return json({ mode: "google", action, meetingId, eventId: event?.id, eventUrl: event?.htmlLink });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error inesperado" }, 500);
  }
});
