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

export const openAIConfigured = () => Boolean(Deno.env.get("OPENAI_API_KEY"));

export const requestOpenAIJson = async <T>({ name, schema, instructions, input, maxOutputTokens }: JsonRequest): Promise<OpenAIJsonResult<T>> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5-nano";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: maxOutputTokens,
      store: false,
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") || "sin-id";
    console.error("OpenAI request failed", response.status, requestId);
    if (response.status === 429) throw new Error("OPENAI_QUOTA_OR_RATE_LIMIT");
    throw new Error(`OPENAI_HTTP_${response.status}`);
  }
  const payload = await response.json();
  const text = payload?.output
    ?.flatMap((item: { content?: unknown[] }) => Array.isArray(item.content) ? item.content : [])
    ?.find((item: { type?: string }) => item.type === "output_text")?.text;
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return { value: JSON.parse(text) as T, model, outputTokens: Number(payload?.usage?.output_tokens || 0) };
};

export const claimAIQuota = async (supabase: any, projectId: string, operation: "transcript" | "document", model: string, inputChars: number) => {
  const { data, error } = await supabase.rpc("claim_ai_request", {
    target_project_id: projectId,
    target_operation: operation,
    target_provider: "openai",
    target_model: model,
    target_input_chars: inputChars,
  });
  if (error) {
    if (String(error.message || "").includes("AI_QUOTA")) throw new Error("AI_QUOTA_REACHED");
    throw error;
  }
  return String(data);
};

export const finishAIQuota = async (supabase: any, requestId: string, status: "succeeded" | "failed", outputTokens = 0, errorCode?: string) => {
  await supabase.rpc("finish_ai_request", {
    target_request_id: requestId,
    target_status: status,
    target_output_tokens: outputTokens,
    target_error_code: errorCode || null,
  });
};
