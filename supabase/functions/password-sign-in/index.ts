import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const getIp = (request: Request) =>
  request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

const hashIp = async (ip: string, secret: string) => {
  const encoded = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) return json({ error: "Servicio de autenticación no disponible." }, 503);

  let credentials: { email?: unknown; password?: unknown };
  try { credentials = await request.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }
  const email = typeof credentials.email === "string" ? credentials.email.trim() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (!email || !password) return json({ error: "Credenciales no válidas." }, 401);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ipHash = await hashIp(getIp(request), serviceRoleKey);
  const { data: limit, error: limitError } = await admin.rpc("claim_password_login_attempt", { target_ip_hash: ipHash });
  if (limitError) {
    console.error("Could not claim password-login attempt", limitError.message);
    return json({ error: "Servicio de autenticación no disponible." }, 503);
  }
  if (!limit?.allowed) return json({ error: "Demasiados intentos. Intenta de nuevo en unos minutos." }, 429);

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    if (response.status === 429) return json({ error: "Demasiados intentos. Intenta de nuevo en unos minutos." }, 429);
    return json({ error: "Credenciales no válidas." }, 401);
  }
  const session = await response.json();
  return json({ session });
});
