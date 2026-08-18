import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimAIQuota, finishAIQuota, openAIConfigured, openAIModel, requestOpenAIJson } from "../_shared/openai.ts";

const headers = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]!));
const list = (items: string[]) => items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>Sin registros.</p>";
const sanitizeGeneratedHtml = (html: string) => html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<(iframe|form|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/javascript:/gi, "");

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Autenticación requerida" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Sesión inválida o vencida" }, 401);
    const { projectId, templateId, documentId, values = {} } = await request.json();
    if (!projectId || !templateId || !documentId) return json({ error: "projectId, templateId y documentId son obligatorios" }, 400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) return json({ error: "documentId no es un UUID válido" }, 400);
    const { data: canAccess } = await supabase.rpc("can_access_project", { target_project_id: projectId });
    if (!canAccess) return json({ error: "No tienes acceso a este proyecto" }, 403);

    const [{ data: project, error: projectError }, { data: template, error: templateError }, { data: tasks }, { data: issues }] = await Promise.all([
      supabase.from("projects").select("title, folder_name, challenge_description, progress_status").eq("id", projectId).single(),
      supabase.from("document_templates").select("*").eq("id", templateId).single(),
      supabase.from("project_tasks").select("title, description, assignee_name, due_date, status").eq("project_id", projectId),
      supabase.from("project_issues").select("title, description, status, priority, resolution").eq("project_id", projectId),
    ]);
    if (projectError || templateError) throw projectError || templateError;
    const safeValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) safeValues[key] = escapeHtml(value);
    const replacements: Record<string, string> = {
      template: escapeHtml(template.name), project: escapeHtml(project.title), project_title: escapeHtml(project.title), project_code: escapeHtml(project.folder_name),
      tasks: list((tasks || []).filter((task) => task.status !== "completada").map((task) => `${task.title} — ${task.assignee_name}${task.due_date ? ` — ${task.due_date}` : ""}`)),
      issues: list((issues || []).filter((issue) => issue.status !== "resuelta").map((issue) => `${issue.title}: ${issue.description}`)), ...safeValues,
    };
    let html = String(template.html_template).replace(/{{\s*([\w_]+)\s*}}/g, (_match: string, key: string) => replacements[key] ?? `<span data-pending="${escapeHtml(key)}">Pendiente de completar: ${escapeHtml(key)}</span>`);
    let provider = "plantilla";

    if (openAIConfigured()) {
      const model = openAIModel();
      const source = html.slice(0, 20_000);
      const requestId = await claimAIQuota(supabase, projectId, "document", model, source.length);
      try {
        const result = await requestOpenAIJson<{ html: string }>({
          name: "institutional_document",
          schema: { type: "object", additionalProperties: false, required: ["html"], properties: { html: { type: "string" } } },
          instructions: "Mejora la redacción del documento HTML en español. Conserva estructura y hechos. No inventes datos. Mantén visibles los campos pendientes. No incluyas scripts, iframes, formularios, objetos, embeds ni enlaces javascript. Devuelve únicamente el JSON solicitado.",
          input: source,
          maxOutputTokens: 2500,
        });
        html = sanitizeGeneratedHtml(result.value.html);
        provider = "openai";
        await finishAIQuota(supabase, requestId, "succeeded", result.outputTokens);
      } catch (error) {
        await finishAIQuota(supabase, requestId, "failed", 0, error instanceof Error ? error.message : "OPENAI_ERROR");
        throw error;
      }
    } else {
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      const model = Deno.env.get("GEMINI_MODEL");
      if (apiKey && model) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Mejora este documento sin inventar datos. Devuelve únicamente HTML seguro.\n\n${html.slice(0, 20_000)}` }] }], generationConfig: { temperature: 0.1 } }) });
        if (response.ok) { const payload = await response.json(); const generated = payload?.candidates?.[0]?.content?.parts?.[0]?.text; if (generated) { html = sanitizeGeneratedHtml(String(generated).replace(/^```html\s*|```$/g, "").trim()); provider = "gemini"; } }
      }
    }

    const { data: document, error } = await supabase.from("project_documents").upsert({ id: documentId, project_id: projectId, template_id: templateId, title: `${template.name} — ${project.folder_name}`, html_content: html, generated_by: user.id, status: "borrador" }).select().single();
    if (error) throw error;
    return json({ document, html, provider });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNEXPECTED_ERROR";
    console.error("generate-document", code);
    if (code === "AI_QUOTA_REACHED") return json({ error: "Límite de IA alcanzado. El borrador de plantilla local se conserva." }, 429);
    if (code.startsWith("OPENAI_")) return json({ error: "OpenAI no pudo mejorar el documento. El borrador local se conserva." }, 502);
    return json({ error: "No fue posible generar el documento" }, 500);
  }
});
