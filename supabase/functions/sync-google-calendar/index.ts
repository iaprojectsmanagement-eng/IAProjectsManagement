import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type GoogleRequest = {
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  body?: string;
};

const calendarErrorMessage = (status: number) => {
  if (status === 401) return "La autorización de Google Calendar venció o no es válida. Renueva el token de Google Calendar.";
  if (status === 403) return "La cuenta autorizada no puede editar este calendario o el token no tiene el permiso calendar.events.";
  if (status === 404) return "No se encontró el calendario o el evento configurado para esta reunión.";
  if (status === 410) return "El evento de Google Calendar ya no existe. Programa nuevamente la reunión para crear uno nuevo.";
  return "Google Calendar rechazó la sincronización. Verifica la configuración de la integración.";
};

async function refreshGoogleAccessToken() {
  const refreshToken = Deno.env.get("GOOGLE_CALENDAR_REFRESH_TOKEN");
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!refreshToken || !clientId || !clientSecret) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    console.error("Google OAuth refresh failed", response.status);
    return null;
  }
  const payload = await response.json();
  return typeof payload?.access_token === "string" ? payload.access_token : null;
}

async function requestGoogleCalendar(request: GoogleRequest, initialToken: string) {
  let response = await fetch(request.endpoint, {
    method: request.method,
    headers: { Authorization: `Bearer ${initialToken}`, "Content-Type": "application/json" },
    body: request.body,
  });

  // An OAuth Playground token is short-lived. If durable OAuth credentials were
  // configured, renew once on 401 and repeat the same Calendar operation.
  if (response.status === 401) {
    const refreshedToken = await refreshGoogleAccessToken();
    if (refreshedToken) {
      response = await fetch(request.endpoint, {
        method: request.method,
        headers: { Authorization: `Bearer ${refreshedToken}`, "Content-Type": "application/json" },
        body: request.body,
      });
    }
  }
  return response;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Autenticación requerida" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Sesión inválida o vencida" }, 401);

    const { meetingId, action = "upsert" } = await request.json();
    if (!meetingId || !["upsert", "cancel"].includes(action)) {
      return json({ error: "meetingId y una acción válida son obligatorios" }, 400);
    }

    const { data: meeting, error } = await supabase
      .from("project_meetings")
      .select("*, projects(title)")
      .eq("id", meetingId)
      .single();
    if (error || !meeting) return json({ error: "Reunión no encontrada o sin acceso" }, 404);

    const accessToken = Deno.env.get("GOOGLE_CALENDAR_ACCESS_TOKEN") || await refreshGoogleAccessToken();
    if (!accessToken) {
      await supabase.from("project_meetings").update({ calendar_sync_status: "simulado" }).eq("id", meetingId);
      return json({ mode: "simulado", action, meetingId, message: "Configura OAuth de Google Calendar para sincronizar eventos reales." });
    }

    const calendarId = encodeURIComponent(Deno.env.get("GOOGLE_CALENDAR_ID") || "primary");
    const eventId = meeting.google_event_id ? encodeURIComponent(meeting.google_event_id) : "";
    if (action === "cancel" && !eventId) return json({ error: "La reunión no tiene un evento de Google asociado" }, 409);

    const endpoint = action === "cancel"
      ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${eventId ? `/${eventId}` : ""}`;
    const method: GoogleRequest["method"] = action === "cancel" ? "DELETE" : eventId ? "PUT" : "POST";
    const end = new Date(new Date(meeting.starts_at).getTime() + meeting.duration_minutes * 60_000).toISOString();
    const attendees = Array.isArray(meeting.attendees)
      ? meeting.attendees.filter((email: unknown) => typeof email === "string" && String(email).includes("@")).map((email: string) => ({ email }))
      : [];
    const body = method === "DELETE" ? undefined : JSON.stringify({
      summary: meeting.title,
      description: `${meeting.agenda || ""}\n\nProyecto: ${meeting.projects?.title || ""}${meeting.meeting_url ? `\nEnlace: ${meeting.meeting_url}` : ""}${meeting.meeting_password ? `\nContraseña: ${meeting.meeting_password}` : ""}`.trim(),
      start: { dateTime: meeting.starts_at, timeZone: meeting.timezone || "America/Bogota" },
      end: { dateTime: end, timeZone: meeting.timezone || "America/Bogota" },
      attendees,
    });

    const response = await requestGoogleCalendar({ endpoint, method, body }, accessToken);
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error("Google Calendar error", response.status, detail);
      await supabase.from("project_meetings").update({ calendar_sync_status: "error" }).eq("id", meetingId);
      return json({ error: calendarErrorMessage(response.status), googleStatus: response.status }, 502);
    }

    const event = method === "DELETE" ? null : await response.json();
    const patch = action === "cancel"
      ? { google_event_id: null, calendar_sync_status: "sincronizado", calendar_event_url: null }
      : { google_event_id: event?.id ?? meeting.google_event_id, calendar_sync_status: "sincronizado", calendar_event_url: event?.htmlLink ?? meeting.calendar_event_url };
    const { error: updateError } = await supabase.from("project_meetings").update(patch).eq("id", meetingId);
    if (updateError) throw updateError;

    return json({ mode: "google", action, meetingId, eventId: event?.id, eventUrl: event?.htmlLink });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error inesperado" }, 500);
  }
});
