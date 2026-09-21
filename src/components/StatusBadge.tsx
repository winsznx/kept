type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

const LABELS: Record<string, [string, Tone]> = {
  CAPTURING: ["CAPTURING", "info"],
  PROTECTED: ["PROTECTED", "ok"],
  ON_TRACK: ["ON TRACK", "ok"],
  MATCH: ["MATCH", "ok"],
  NEEDS_REVIEW: ["NEEDS REVIEW", "warn"],
  REVIEW_REQUIRED: ["NEEDS REVIEW", "warn"],
  MATERIAL_DIFFERENCE: ["MATERIAL DIFFERENCE", "bad"],
  EXPECTED_CHANGE: ["EXPECTED CHANGE", "neutral"],
  INSUFFICIENT_EVIDENCE: ["MISSING EVIDENCE", "warn"],
  SOURCE_CONFLICT: ["SOURCE CONFLICT", "warn"],
  CASE_OPEN: ["CASE OPEN", "info"],
  ARCHIVED: ["ARCHIVED", "neutral"],
  FAILED: ["FAILED", "bad"],
  NO_MATERIAL_CHANGE: ["NO MATERIAL CHANGE", "ok"],
  MATERIAL_CHANGE: ["MATERIAL DIFFERENCE", "bad"],
  NOT_ESTABLISHED: ["APPLICABILITY NOT ESTABLISHED", "warn"],
  APPLIES: ["APPLIES", "ok"],
  DOES_NOT_APPLY: ["DOES NOT APPLY", "warn"],
  DRAFT: ["DRAFT", "neutral"],
  READY_TO_SEND: ["READY TO SEND", "info"],
  SENDING: ["SENDING", "info"],
  WAITING_FOR_REPLY: ["WAITING FOR REPLY", "info"],
  REPLY_RECEIVED: ["REPLY RECEIVED", "info"],
  NEEDS_USER_ACTION: ["NEEDS YOUR ACTION", "warn"],
  RESOLVED: ["RESOLVED", "ok"],
  CLOSED: ["CLOSED WITHOUT CONFIRMATION", "neutral"],
  PROVIDER_CLAIMS_FIXED: ["PROVIDER SAYS FIXED", "warn"],
  WAITING_TO_VERIFY: ["WAITING TO VERIFY", "warn"],
  VERIFIED_FIXED: ["VERIFIED FIXED", "ok"],
  STILL_MISMATCHED: ["STILL MISMATCHED", "bad"],
  NOT_DUE: ["NOT DUE YET", "neutral"],
  NOT_OBSERVED: ["NO BILL", "neutral"],
  AUTO_DETERMINISTIC: ["SOURCE-BOUND", "ok"],
  DISPLAY_ONLY: ["DISPLAY ONLY", "neutral"],
  REJECTED: ["REJECTED", "bad"],
  QUEUED: ["QUEUED", "neutral"],
  RUNNING: ["RUNNING", "info"],
  SUCCEEDED: ["DONE", "ok"],
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const [label, tone] = LABELS[status ?? ""] ?? [status ?? "UNKNOWN", "neutral"];
  return <span className={`badge tone-${tone}`}>{label}</span>;
}
