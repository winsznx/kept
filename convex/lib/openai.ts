import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

/** Only import from "use node" action modules. */

export type ModelRole = "EXTRACT" | "REASON";

export class AiError extends Error {
  readonly code: "AI_UNAVAILABLE" | "OPENAI_RATE_LIMIT" | "OPENAI_FAILED" | "AI_SCHEMA_FAILED" | "AI_REFUSED";
  constructor(code: AiError["code"], message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}

export function modelFor(role: ModelRole): string {
  return role === "EXTRACT"
    ? (process.env.OPENAI_MODEL_EXTRACT ?? "gpt-5.6-terra")
    : (process.env.OPENAI_MODEL_REASON ?? "gpt-5.6-sol");
}

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AiError("AI_UNAVAILABLE", "OPENAI_API_KEY not configured");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2, timeout: 120_000 });
  return client;
}

export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" };

export type StructuredResult<T> = { parsed: T; modelId: string; responseId: string | null; latencyMs: number; usage: { inputTokens: number; outputTokens: number } };

/**
 * One strict Structured Outputs call through the Responses API. Fails closed: any
 * refusal, incomplete response, or schema failure throws instead of returning data.
 */
export async function callStructured<S extends z.ZodType>(args: {
  schema: S;
  schemaName: string;
  system: string;
  input: string | InputPart[];
  role: ModelRole;
  effort?: "low" | "medium" | "high";
}): Promise<StructuredResult<z.infer<S>>> {
  const modelId = modelFor(args.role);
  const started = Date.now();
  const content: InputPart[] = typeof args.input === "string" ? [{ type: "input_text", text: args.input }] : args.input;
  try {
    const response = await getClient().responses.parse({
      model: modelId,
      store: false,
      reasoning: { effort: args.effort ?? "low" },
      input: [
        { role: "developer", content: args.system },
        { role: "user", content },
      ],
      text: { format: zodTextFormat(args.schema, args.schemaName) },
    });
    if (response.status === "incomplete") throw new AiError("OPENAI_FAILED", "incomplete response");
    for (const item of response.output) {
      if (item.type === "message" && item.content.some((c) => c.type === "refusal")) throw new AiError("AI_REFUSED", "model refused");
    }
    const parsed = response.output_parsed;
    if (parsed === null || parsed === undefined) throw new AiError("AI_SCHEMA_FAILED", "no parsed output");
    const check = args.schema.safeParse(parsed);
    if (!check.success) throw new AiError("AI_SCHEMA_FAILED", "schema validation failed");
    return { parsed: check.data, modelId, responseId: response.id ?? null, latencyMs: Date.now() - started, usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 } };
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof OpenAI.RateLimitError) {
      const quota = (err.code ?? "") === "insufficient_quota" || (err.code ?? "") === "credit_balance_exhausted" || /quota|credit/i.test(err.message);
      throw new AiError(quota ? "AI_UNAVAILABLE" : "OPENAI_RATE_LIMIT", quota ? "quota exhausted" : "rate limited");
    }
    if (err instanceof OpenAI.APIError) throw new AiError("OPENAI_FAILED", `api error ${err.status ?? "?"}`);
    throw new AiError("OPENAI_FAILED", "request failed");
  }
}
