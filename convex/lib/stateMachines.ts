export class InvalidStateTransitionError extends Error {
  constructor(machine: string, from: string, to: string) {
    super(`INVALID_STATE_TRANSITION: ${machine} ${from} -> ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

type Machine<S extends string> = Readonly<Record<S, readonly S[]>>;

function makeGuard<S extends string>(name: string, table: Machine<S>) {
  return {
    table,
    can(from: S, to: S): boolean {
      return table[from].includes(to);
    },
    assert(from: S, to: S): void {
      if (!table[from].includes(to)) throw new InvalidStateTransitionError(name, from, to);
    },
  };
}

export type ItemStatus = "CAPTURING" | "PROTECTED" | "NEEDS_REVIEW" | "MATERIAL_DIFFERENCE" | "CASE_OPEN" | "ARCHIVED" | "FAILED";

/** PRD 16.1, plus self-loops for idempotent re-reconciliation and recovery from review/failure. */
export const itemMachine = makeGuard<ItemStatus>("protectedItem", {
  CAPTURING: ["CAPTURING", "PROTECTED", "NEEDS_REVIEW", "FAILED", "MATERIAL_DIFFERENCE", "ARCHIVED"],
  PROTECTED: ["PROTECTED", "MATERIAL_DIFFERENCE", "NEEDS_REVIEW", "ARCHIVED", "CAPTURING"],
  NEEDS_REVIEW: ["NEEDS_REVIEW", "PROTECTED", "MATERIAL_DIFFERENCE", "ARCHIVED", "CAPTURING", "FAILED"],
  MATERIAL_DIFFERENCE: ["MATERIAL_DIFFERENCE", "CASE_OPEN", "PROTECTED", "NEEDS_REVIEW", "ARCHIVED"],
  CASE_OPEN: ["CASE_OPEN", "MATERIAL_DIFFERENCE", "PROTECTED", "ARCHIVED"],
  FAILED: ["FAILED", "CAPTURING", "ARCHIVED"],
  ARCHIVED: ["ARCHIVED"],
});

export type CaseStatus =
  | "DRAFT"
  | "READY_TO_SEND"
  | "SENDING"
  | "WAITING_FOR_REPLY"
  | "REPLY_RECEIVED"
  | "NEEDS_USER_ACTION"
  | "RESOLVED"
  | "CLOSED";

/**
 * PRD 16.3/16.4. READY_TO_SEND -> SENDING is only legal through the user-approval
 * mutation (see `approvalRequiredFor`). RESOLVED/CLOSED never return to SENDING.
 */
export const caseMachine = makeGuard<CaseStatus>("case", {
  DRAFT: ["READY_TO_SEND", "CLOSED"],
  READY_TO_SEND: ["DRAFT", "SENDING", "CLOSED"],
  SENDING: ["WAITING_FOR_REPLY", "READY_TO_SEND", "NEEDS_USER_ACTION"],
  WAITING_FOR_REPLY: ["REPLY_RECEIVED", "NEEDS_USER_ACTION", "RESOLVED", "CLOSED"],
  REPLY_RECEIVED: ["NEEDS_USER_ACTION", "WAITING_FOR_REPLY", "RESOLVED", "CLOSED", "READY_TO_SEND"],
  NEEDS_USER_ACTION: ["READY_TO_SEND", "WAITING_FOR_REPLY", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "NEEDS_USER_ACTION"],
  CLOSED: [],
});

export function approvalRequiredFor(from: CaseStatus, to: CaseStatus): boolean {
  return from === "READY_TO_SEND" && to === "SENDING";
}

export type ResolutionState =
  | "NONE"
  | "PROVIDER_CLAIMS_FIXED"
  | "WAITING_TO_VERIFY"
  | "VERIFIED_FIXED"
  | "STILL_MISMATCHED";

/**
 * PRD 16.5. A provider claim can only reach WAITING_TO_VERIFY. VERIFIED_FIXED and
 * STILL_MISMATCHED are reachable only from WAITING_TO_VERIFY, i.e. after a later
 * observation has been reconciled. INSUFFICIENT_EVIDENCE keeps WAITING_TO_VERIFY.
 */
export const resolutionMachine = makeGuard<ResolutionState>("resolution", {
  NONE: ["NONE", "PROVIDER_CLAIMS_FIXED"],
  PROVIDER_CLAIMS_FIXED: ["WAITING_TO_VERIFY"],
  WAITING_TO_VERIFY: ["WAITING_TO_VERIFY", "VERIFIED_FIXED", "STILL_MISMATCHED"],
  STILL_MISMATCHED: ["STILL_MISMATCHED", "PROVIDER_CLAIMS_FIXED"],
  VERIFIED_FIXED: ["VERIFIED_FIXED"],
});

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW";

export const jobMachine = makeGuard<JobStatus>("job", {
  QUEUED: ["RUNNING", "FAILED"],
  RUNNING: ["RUNNING", "SUCCEEDED", "FAILED", "NEEDS_REVIEW"],
  SUCCEEDED: [],
  FAILED: ["QUEUED"],
  NEEDS_REVIEW: ["QUEUED"],
});
