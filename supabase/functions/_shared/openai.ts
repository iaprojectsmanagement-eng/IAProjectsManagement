export interface OpenAIJsonResult<T> {
  value: T;
  model: string;
  outputTokens: number;
}

interface JsonRequest {
  name: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string;
  maxOutputTokens: number;
}

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const REQUEST_TIMEOUT_MS = 45_000;
const MODEL_NAME = /^[a-zA-Z0-9._-]{1,100}$/;
export const OPENAI_MODEL = "gpt-5.6-luna";

const configuredModel = () => {
  // Model selection is server-owned and intentionally has no environment override.
  const model = OPENAI_MODEL;
  if (!MODEL_NAME.test(model)) throw new Error("OPENAI_INVALID_MODEL");
  return model;
};

const responseText = (payload: any): string | null => {
  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "refusal") throw new Error("OPENAI_REFUSAL");
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
};

export const openAIConfigured = () => Boolean(Deno.env.get("OPENAI_API_KEY")?.trim());
export const openAIModel = () => configuredModel();

export const requestOpenAIJson = async <T>({ name, schema, instructions, input, maxOutputTokens }: JsonRequest): Promise<OpenAIJsonResult<T>> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  if (!name || !schema || !instructions || !input || maxOutputTokens < 1) throw new Error("OPENAI_INVALID_REQUEST");
  const model = configuredModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        input,
        reasoning: { effort: "medium" },
        max_output_tokens: maxOutputTokens,
        store: false,
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("OPENAI_TIMEOUT");
    throw new Error("OPENAI_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") || "sin-id";
    console.error("OpenAI request failed", response.status, requestId);
    if (response.status === 429) throw new Error("OPENAI_QUOTA_OR_RATE_LIMIT");
    throw new Error(`OPENAI_HTTP_${response.status}`);
  }
  let payload: any;
  try { payload = await response.json(); } catch { throw new Error("OPENAI_INVALID_PROVIDER_RESPONSE"); }
  if (payload?.status === "incomplete" || payload?.incomplete_details) throw new Error("OPENAI_INCOMPLETE_RESPONSE");
  const text = responseText(payload);
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid root");
    return { value: value as T, model, outputTokens: Number(payload?.usage?.output_tokens || 0) };
  } catch {
    throw new Error("OPENAI_INVALID_STRUCTURED_OUTPUT");
  }
};

export const aiQuotaMessage = (code: string) => {
  if (code.includes("AI_QUOTA_MINUTE")) return "Límite de 3 llamadas por minuto excedido. Espera un momento antes de intentarlo de nuevo.";
  if (code.includes("AI_QUOTA_HOUR")) return "Límite de 10 llamadas por hora excedido. Espera antes de volver a usar la IA.";
  if (code.includes("AI_QUOTA_DAY")) return "Límite de 20 llamadas por día excedido. Inténtalo de nuevo mañana.";
  return "Límite de consultas a la IA excedido. Espera antes de intentarlo de nuevo.";
};

export const isAIQuotaError = (code: string) => code.startsWith("AI_QUOTA_");

export const claimAIQuota = async (supabase: any, projectId: string, operation: "transcript" | "document", model: string, inputChars: number, provider: "openai" | "gemini" = "openai") => {
  const { data, error } = await supabase.rpc("claim_ai_request", {
    target_project_id: projectId,
    target_operation: operation,
    target_provider: provider,
    target_model: model,
    target_input_chars: inputChars,
  });
  if (error) throw error;
  const result = data as { requestId?: string; quota?: "minute" | "hour" | "day" } | null;
  if (result?.quota) throw new Error(`AI_QUOTA_${result.quota.toUpperCase()}`);
  if (!result?.requestId) throw new Error("AI_QUOTA_UNKNOWN");
  return result.requestId;
};

export const finishAIQuota = async (supabase: any, requestId: string, status: "succeeded" | "failed", outputTokens = 0, errorCode?: string) => {
  await supabase.rpc("finish_ai_request", {
    target_request_id: requestId,
    target_status: status,
    target_output_tokens: outputTokens,
    target_error_code: errorCode || null,
  });
};
