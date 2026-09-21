/**
 * Single server-side adapter for direct AgentMail REST calls (inbox creation, sends,
 * replies, attachments). Webhook ingest goes through the official @agentmail/convex
 * component; see docs/DECISIONS.md for why sends bypass the component.
 */
const BASE_URL = "https://api.agentmail.to/v0";

export class AgentMailApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`AgentMail request failed: ${status} ${code}`);
    this.name = "AgentMailApiError";
    this.status = status;
    this.code = code;
  }
}

function apiKey(): string {
  const key = process.env.AGENTMAIL_API_KEY;
  if (!key) throw new AgentMailApiError(0, "AGENTMAIL_NOT_CONFIGURED");
  return key;
}

export function agentmailConfigured(): boolean {
  return Boolean(process.env.AGENTMAIL_API_KEY);
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let code = "UNKNOWN";
    try {
      const j = (await res.json()) as { name?: string; error?: string };
      code = j.name ?? j.error ?? code;
    } catch {
      code = `HTTP_${res.status}`;
    }
    throw new AgentMailApiError(res.status, code.slice(0, 80));
  }
  return (await res.json()) as T;
}

export type AgentMailInbox = { inbox_id: string; email?: string; client_id?: string | null };

/** Idempotent: AgentMail returns the original inbox for a repeated client_id. */
export async function createInbox(clientId: string, displayName: string): Promise<AgentMailInbox> {
  return await request<AgentMailInbox>("POST", "/inboxes", { client_id: clientId, display_name: displayName });
}

export type SendResult = { message_id: string; thread_id: string };

export async function sendMessage(
  inboxId: string,
  msg: { to: string; subject: string; text: string; html?: string },
  idempotencyKey: string,
): Promise<SendResult> {
  return await request<SendResult>("POST", `/inboxes/${encodeURIComponent(inboxId)}/messages/send`, msg, idempotencyKey);
}

export async function replyToMessage(
  inboxId: string,
  messageId: string,
  msg: { text: string; html?: string },
  idempotencyKey: string,
): Promise<SendResult> {
  return await request<SendResult>(
    "POST",
    `/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/reply`,
    msg,
    idempotencyKey,
  );
}

export type AttachmentInfo = { attachment_id: string; size: number; download_url: string; filename?: string; content_type?: string };

export async function getAttachment(inboxId: string, messageId: string, attachmentId: string): Promise<AttachmentInfo> {
  return await request<AttachmentInfo>(
    "GET",
    `/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
}

export function isTransient(err: unknown): boolean {
  if (!(err instanceof AgentMailApiError)) return true;
  if (err.code === "AGENTMAIL_NOT_CONFIGURED") return false;
  return err.status === 429 || err.status >= 500;
}
