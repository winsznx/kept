import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const sourceClass = v.union(
  v.literal("TRANSACTION_EMAIL"),
  v.literal("TRANSACTION_RECEIPT"),
  v.literal("CONTRACT_OR_ORDER"),
  v.literal("BILL_OR_STATEMENT"),
  v.literal("FIRST_PARTY_PUBLIC_PAGE"),
  v.literal("FIRST_PARTY_SUPPORT_REPLY"),
  v.literal("USER_ASSERTION"),
  v.literal("SECONDARY_PUBLIC_PAGE"),
  v.literal("UNKNOWN_SOURCE"),
);

export const commitmentKind = v.union(
  v.literal("PROMO_CREDIT_FIXED"),
  v.literal("PROMO_CREDIT_SCHEDULE"),
  v.literal("PROMO_PRICE_FIXED"),
  v.literal("PROMO_PRICE_MAX"),
  v.literal("DURATION_MONTHS"),
  v.literal("EFFECTIVE_END_DATE"),
  v.literal("REQUIRED_PLAN"),
  v.literal("REBATE_DEADLINE"),
  v.literal("RETURN_DEADLINE"),
  v.literal("TRADE_IN_AMOUNT"),
  v.literal("OTHER_TEXTUAL"),
);

export const itemStatus = v.union(
  v.literal("CAPTURING"),
  v.literal("PROTECTED"),
  v.literal("NEEDS_REVIEW"),
  v.literal("MATERIAL_DIFFERENCE"),
  v.literal("CASE_OPEN"),
  v.literal("ARCHIVED"),
  v.literal("FAILED"),
);

export const valueType = v.union(v.literal("MONEY"), v.literal("INTEGER"), v.literal("DATE"), v.literal("TEXT"), v.literal("BOOLEAN"));
export const confidence = v.union(v.literal("HIGH"), v.literal("MEDIUM"), v.literal("LOW"));
export const evidenceBinding = v.union(v.literal("VALID"), v.literal("PARTIAL"), v.literal("FAILED"));
export const decisionEligibility = v.union(
  v.literal("AUTO_DETERMINISTIC"),
  v.literal("DISPLAY_ONLY"),
  v.literal("REVIEW_REQUIRED"),
  v.literal("REJECTED"),
);
export const cadence = v.union(v.literal("MONTHLY"), v.literal("ONE_TIME"), v.literal("ANNUAL"), v.literal("UNKNOWN"));

export const overallOutcome = v.union(
  v.literal("MATCH"),
  v.literal("MATERIAL_DIFFERENCE"),
  v.literal("EXPECTED_CHANGE"),
  v.literal("INSUFFICIENT_EVIDENCE"),
  v.literal("SOURCE_CONFLICT"),
  v.literal("REVIEW_REQUIRED"),
);

export const caseStatus = v.union(
  v.literal("DRAFT"),
  v.literal("READY_TO_SEND"),
  v.literal("SENDING"),
  v.literal("WAITING_FOR_REPLY"),
  v.literal("REPLY_RECEIVED"),
  v.literal("NEEDS_USER_ACTION"),
  v.literal("RESOLVED"),
  v.literal("CLOSED"),
);

export const resolutionState = v.union(
  v.literal("NONE"),
  v.literal("PROVIDER_CLAIMS_FIXED"),
  v.literal("WAITING_TO_VERIFY"),
  v.literal("VERIFIED_FIXED"),
  v.literal("STILL_MISMATCHED"),
);

export const jobStatus = v.union(
  v.literal("QUEUED"),
  v.literal("RUNNING"),
  v.literal("SUCCEEDED"),
  v.literal("FAILED"),
  v.literal("NEEDS_REVIEW"),
);

export const inboundClassification = v.union(
  v.literal("SIGNUP_OR_ORDER"),
  v.literal("BILL_OR_STATEMENT"),
  v.literal("SUPPORT_REPLY"),
  v.literal("UNRELATED"),
  v.literal("UNKNOWN"),
);

export default defineSchema({
  ...authTables,

  workspaces: defineTable({
    ownerUserId: v.union(v.id("users"), v.null()),
    kind: v.union(v.literal("USER"), v.literal("DEMO")),
    name: v.union(v.string(), v.null()),
    agentmailInboxId: v.union(v.string(), v.null()),
    agentmailInboxAddress: v.union(v.string(), v.null()),
    demoSessionKeyHash: v.union(v.string(), v.null()),
    expiresAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerUserId", ["ownerUserId"])
    .index("by_kind_expiresAt", ["kind", "expiresAt"])
    .index("by_demoSessionKeyHash", ["demoSessionKeyHash"])
    .index("by_agentmailInboxId", ["agentmailInboxId"]),

  protectedItems: defineTable({
    workspaceId: v.id("workspaces"),
    providerName: v.union(v.string(), v.null()),
    productName: v.union(v.string(), v.null()),
    category: v.union(v.literal("MOBILE"), v.literal("INTERNET"), v.literal("DEVICE"), v.literal("OTHER")),
    status: itemStatus,
    transactionAt: v.union(v.number(), v.null()),
    protectedAt: v.union(v.number(), v.null()),
    primaryCurrency: v.string(),
    summary: v.union(v.string(), v.null()),
    /** Schedule anchor: first billing month the recurring promise applies to (YYYY-MM). */
    scheduleStartMonth: v.union(v.string(), v.null()),
    /** Short token users can put in a forwarded subject line to route mail to this item. */
    routingToken: v.string(),
    /** Seller/region context extracted (with bound evidence) from the transaction record. */
    transactionContextJson: v.union(v.string(), v.null()),
    transactionContextCaptureId: v.union(v.id("sourceCaptures"), v.null()),
    latestReconciliationId: v.union(v.id("reconciliations"), v.null()),
    resolutionState: resolutionState,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace_createdAt", ["workspaceId", "createdAt"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_routingToken", ["routingToken"]),

  documents: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.union(v.id("protectedItems"), v.null()),
    sourceCaptureId: v.union(v.id("sourceCaptures"), v.null()),
    sourceClass: sourceClass,
    storageId: v.union(v.id("_storage"), v.null()),
    agentmailMessageId: v.union(v.string(), v.null()),
    agentmailThreadId: v.union(v.string(), v.null()),
    filename: v.union(v.string(), v.null()),
    mimeType: v.union(v.string(), v.null()),
    byteSize: v.union(v.number(), v.null()),
    sha256: v.union(v.string(), v.null()),
    originalText: v.union(v.string(), v.null()),
    status: v.union(v.literal("RECEIVED"), v.literal("PROCESSING"), v.literal("READY"), v.literal("FAILED")),
    createdAt: v.number(),
  })
    .index("by_item_createdAt", ["protectedItemId", "createdAt"])
    .index("by_workspace_createdAt", ["workspaceId", "createdAt"])
    .index("by_agentmailMessageId", ["agentmailMessageId"]),

  sourceCaptures: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    sourceClass: sourceClass,
    sourceUri: v.union(v.string(), v.null()),
    sourceDomain: v.union(v.string(), v.null()),
    isFirstParty: v.union(v.boolean(), v.null()),
    discovered: v.boolean(),
    documentId: v.union(v.id("documents"), v.null()),
    rawTextStorageId: v.union(v.id("_storage"), v.null()),
    normalizedText: v.union(v.string(), v.null()),
    contentSha256: v.string(),
    capturedAt: v.number(),
    claimedEffectiveAt: v.union(v.number(), v.null()),
    transactionAt: v.union(v.number(), v.null()),
    provenanceRank: v.number(),
    firecrawlJobId: v.union(v.string(), v.null()),
    firecrawlMetadataJson: v.union(v.string(), v.null()),
    /** Prior capture of the same URI this one refreshes; null for T0. */
    previousCaptureId: v.union(v.id("sourceCaptures"), v.null()),
    parseStatus: v.union(v.literal("PENDING"), v.literal("PARSED"), v.literal("NEEDS_REVIEW"), v.literal("FAILED")),
    failureCode: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_item_capturedAt", ["protectedItemId", "capturedAt"])
    .index("by_item_sourceClass", ["protectedItemId", "sourceClass"])
    .index("by_uri_capturedAt", ["sourceUri", "capturedAt"])
    .index("by_contentSha256", ["contentSha256"]),

  /** Mutable parse outcome for an immutable capture: kept separate so captures never change. */
  captureParses: defineTable({
    workspaceId: v.id("workspaces"),
    sourceCaptureId: v.id("sourceCaptures"),
    status: v.union(v.literal("PARSED"), v.literal("NEEDS_REVIEW"), v.literal("FAILED")),
    failureCode: v.union(v.string(), v.null()),
    modelId: v.union(v.string(), v.null()),
    schemaVersion: v.string(),
    unknowns: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_source", ["sourceCaptureId"]),

  commitments: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    sourceCaptureId: v.id("sourceCaptures"),
    kind: commitmentKind,
    key: v.string(),
    label: v.string(),
    valueType: valueType,
    currency: v.union(v.string(), v.null()),
    amountCents: v.union(v.number(), v.null()),
    integerValue: v.union(v.number(), v.null()),
    dateValue: v.union(v.number(), v.null()),
    textValue: v.union(v.string(), v.null()),
    booleanValue: v.union(v.boolean(), v.null()),
    cadence: v.union(cadence, v.null()),
    periodCount: v.union(v.number(), v.null()),
    effectiveStartAt: v.union(v.number(), v.null()),
    effectiveEndAt: v.union(v.number(), v.null()),
    confidence: confidence,
    evidenceBinding: evidenceBinding,
    decisionEligibility: decisionEligibility,
    ambiguity: v.union(v.string(), v.null()),
    schemaVersion: v.string(),
    modelId: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_item_kind", ["protectedItemId", "kind"])
    .index("by_item_key", ["protectedItemId", "key"])
    .index("by_source", ["sourceCaptureId"]),

  commitmentEvidence: defineTable({
    workspaceId: v.id("workspaces"),
    commitmentId: v.id("commitments"),
    sourceCaptureId: v.id("sourceCaptures"),
    excerpt: v.string(),
    page: v.union(v.number(), v.null()),
    sectionHint: v.union(v.string(), v.null()),
    normalizedExcerptHash: v.string(),
    bindingValidated: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_commitment", ["commitmentId"])
    .index("by_source", ["sourceCaptureId"]),

  commitmentConditions: defineTable({
    workspaceId: v.id("workspaces"),
    commitmentId: v.id("commitments"),
    conditionType: v.string(),
    conditionText: v.string(),
    normalizedValue: v.union(v.string(), v.null()),
    decisionEligibility: decisionEligibility,
    createdAt: v.number(),
  }).index("by_commitment", ["commitmentId"]),

  expectedEvents: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    commitmentId: v.id("commitments"),
    periodIndex: v.union(v.number(), v.null()),
    expectedAt: v.union(v.number(), v.null()),
    windowStartAt: v.union(v.number(), v.null()),
    windowEndAt: v.union(v.number(), v.null()),
    kind: commitmentKind,
    expectedAmountCents: v.union(v.number(), v.null()),
    currency: v.union(v.string(), v.null()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("OBSERVED_MATCH"),
      v.literal("OBSERVED_DIFFERENCE"),
      v.literal("NOT_DUE"),
      v.literal("UNKNOWN"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_item_expectedAt", ["protectedItemId", "expectedAt"])
    .index("by_commitment_periodIndex", ["commitmentId", "periodIndex"])
    .index("by_item_status", ["protectedItemId", "status"]),

  /** One row per observed statement/bill: the unit of reconciliation. */
  statements: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    sourceCaptureId: v.id("sourceCaptures"),
    providerName: v.union(v.string(), v.null()),
    statementMonth: v.union(v.string(), v.null()),
    statementDateIso: v.union(v.string(), v.null()),
    servicePeriodStartIso: v.union(v.string(), v.null()),
    servicePeriodEndIso: v.union(v.string(), v.null()),
    planName: v.union(v.string(), v.null()),
    itemized: v.boolean(),
    totalAmountCents: v.union(v.number(), v.null()),
    modelId: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_item_createdAt", ["protectedItemId", "createdAt"])
    .index("by_source", ["sourceCaptureId"]),

  observations: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    sourceCaptureId: v.id("sourceCaptures"),
    statementId: v.union(v.id("statements"), v.null()),
    observationType: v.union(
      v.literal("BILL_LINE_ITEM"),
      v.literal("PLAN_NAME"),
      v.literal("PUBLIC_TERM"),
      v.literal("SUPPORT_ASSERTION"),
      v.literal("USER_FACT"),
    ),
    key: v.string(),
    label: v.string(),
    category: v.union(v.string(), v.null()),
    matchesCommitment: v.union(v.literal("YES"), v.literal("NO"), v.literal("AMBIGUOUS"), v.null()),
    observedAt: v.union(v.number(), v.null()),
    statementAt: v.union(v.number(), v.null()),
    valueType: valueType,
    currency: v.union(v.string(), v.null()),
    amountCents: v.union(v.number(), v.null()),
    integerValue: v.union(v.number(), v.null()),
    dateValue: v.union(v.number(), v.null()),
    textValue: v.union(v.string(), v.null()),
    booleanValue: v.union(v.boolean(), v.null()),
    evidenceExcerpt: v.union(v.string(), v.null()),
    confidence: confidence,
    evidenceBinding: evidenceBinding,
    decisionEligibility: decisionEligibility,
    modelId: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_item_observedAt", ["protectedItemId", "observedAt"])
    .index("by_item_key", ["protectedItemId", "key"])
    .index("by_source", ["sourceCaptureId"])
    .index("by_statement", ["statementId"]),

  reconciliations: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    triggerType: v.union(v.literal("SOURCE_INGESTED"), v.literal("SOURCE_REFRESH"), v.literal("MANUAL"), v.literal("EVALUATION")),
    status: v.union(v.literal("RUNNING"), v.literal("COMPLETE"), v.literal("FAILED")),
    overallOutcome: v.union(overallOutcome, v.null()),
    observedDifferenceCents: v.union(v.number(), v.null()),
    remainingScheduledValueCents: v.union(v.number(), v.null()),
    observedReceivedCents: v.union(v.number(), v.null()),
    notYetDueCents: v.union(v.number(), v.null()),
    latestObservedPeriod: v.union(v.number(), v.null()),
    periodCount: v.union(v.number(), v.null()),
    currency: v.union(v.string(), v.null()),
    mechanismVersion: v.string(),
    startedAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    failureCode: v.union(v.string(), v.null()),
  })
    .index("by_item_startedAt", ["protectedItemId", "startedAt"])
    .index("by_item_outcome", ["protectedItemId", "overallOutcome"]),

  reconciliationFindings: defineTable({
    workspaceId: v.id("workspaces"),
    reconciliationId: v.id("reconciliations"),
    protectedItemId: v.id("protectedItems"),
    commitmentId: v.union(v.id("commitments"), v.null()),
    expectedEventId: v.union(v.id("expectedEvents"), v.null()),
    observationId: v.union(v.id("observations"), v.null()),
    statementId: v.union(v.id("statements"), v.null()),
    periodIndex: v.union(v.number(), v.null()),
    kind: v.string(),
    outcome: v.string(),
    expectedDisplay: v.string(),
    observedDisplay: v.string(),
    amountDeltaCents: v.union(v.number(), v.null()),
    reasonCode: v.string(),
    explanation: v.string(),
    material: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_reconciliation", ["reconciliationId"])
    .index("by_item_material", ["protectedItemId", "material"]),

  /** T0 vs Tn comparison of two captures of the same public source (FR-014). */
  pageComparisons: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    t0CaptureId: v.id("sourceCaptures"),
    tnCaptureId: v.id("sourceCaptures"),
    rawSourceChanged: v.boolean(),
    materialCommercialChange: v.boolean(),
    outcome: v.union(v.literal("NO_MATERIAL_CHANGE"), v.literal("MATERIAL_CHANGE"), v.literal("INSUFFICIENT_EVIDENCE")),
    diffsJson: v.string(),
    mechanismVersion: v.string(),
    createdAt: v.number(),
  }).index("by_item_createdAt", ["protectedItemId", "createdAt"]),

  /** Deterministic applicability check between a transaction and a policy source (refusal path). */
  applicabilityChecks: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    policyCaptureId: v.id("sourceCaptures"),
    transactionCaptureId: v.union(v.id("sourceCaptures"), v.null()),
    outcome: v.union(v.literal("APPLIES"), v.literal("NOT_ESTABLISHED"), v.literal("DOES_NOT_APPLY")),
    reasons: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_item_createdAt", ["protectedItemId", "createdAt"]),

  cases: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    status: caseStatus,
    issueType: v.string(),
    recipientEmail: v.union(v.string(), v.null()),
    subject: v.union(v.string(), v.null()),
    draftText: v.union(v.string(), v.null()),
    draftSource: v.union(v.literal("MODEL"), v.literal("TEMPLATE"), v.null()),
    agentmailThreadId: v.union(v.string(), v.null()),
    agentmailOutboundId: v.union(v.string(), v.null()),
    sendIdempotencyKey: v.union(v.string(), v.null()),
    approvedAt: v.union(v.number(), v.null()),
    latestPacketVersion: v.number(),
    disputedPeriods: v.array(v.number()),
    resolutionState: resolutionState,
    resolutionSummary: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_item_createdAt", ["protectedItemId", "createdAt"])
    .index("by_thread", ["agentmailThreadId"]),

  caseEvidencePackets: defineTable({
    workspaceId: v.id("workspaces"),
    caseId: v.id("cases"),
    version: v.number(),
    payloadJson: v.string(),
    payloadSha256: v.string(),
    createdAt: v.number(),
  }).index("by_case_version", ["caseId", "version"]),

  caseEvents: defineTable({
    workspaceId: v.id("workspaces"),
    caseId: v.id("cases"),
    type: v.union(
      v.literal("CREATED"),
      v.literal("DRAFTED"),
      v.literal("APPROVED"),
      v.literal("SENT"),
      v.literal("DELIVERED"),
      v.literal("BOUNCED"),
      v.literal("SEND_FAILED"),
      v.literal("REPLY_RECEIVED"),
      v.literal("PROVIDER_CLAIMS_FIXED"),
      v.literal("WAITING_TO_VERIFY"),
      v.literal("VERIFIED_FIXED"),
      v.literal("STILL_MISMATCHED"),
      v.literal("VERIFICATION_INSUFFICIENT"),
      v.literal("EVIDENCE_ADDED"),
      v.literal("RESOLVED"),
      v.literal("CLOSED"),
    ),
    externalMessageId: v.union(v.string(), v.null()),
    /** Dedupe key so duplicate webhooks cannot produce duplicate events. */
    dedupeKey: v.union(v.string(), v.null()),
    summary: v.string(),
    createdAt: v.number(),
  })
    .index("by_case_createdAt", ["caseId", "createdAt"])
    .index("by_dedupeKey", ["dedupeKey"]),

  /** Structured claims extracted from provider replies. Claims, not facts. */
  providerAssertions: defineTable({
    workspaceId: v.id("workspaces"),
    caseId: v.id("cases"),
    agentmailMessageId: v.string(),
    assertionType: v.string(),
    assertion: v.string(),
    excerpt: v.string(),
    bindingValidated: v.boolean(),
    assessment: v.union(
      v.literal("SUPPORTED_BY_CAPTURED_EVIDENCE"),
      v.literal("CONTRADICTED_BY_CAPTURED_EVIDENCE"),
      v.literal("NOT_ESTABLISHED"),
      v.literal("NEW_EVIDENCE_REQUIRED"),
    ),
    confidence: confidence,
    createdAt: v.number(),
  }).index("by_case", ["caseId"]),

  resolutionVerifications: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    caseId: v.id("cases"),
    claimedResolutionMessageId: v.union(v.string(), v.null()),
    claimedResolutionAt: v.union(v.number(), v.null()),
    claimAfterPeriod: v.union(v.number(), v.null()),
    verificationStatementId: v.union(v.id("statements"), v.null()),
    reconciliationId: v.union(v.id("reconciliations"), v.null()),
    result: v.union(
      v.literal("WAITING_TO_VERIFY"),
      v.literal("VERIFIED_FIXED"),
      v.literal("STILL_MISMATCHED"),
      v.literal("INSUFFICIENT_EVIDENCE"),
    ),
    verifiedRestoredCents: v.number(),
    currency: v.union(v.string(), v.null()),
    expectedPeriodKey: v.union(v.string(), v.null()),
    evidenceRefs: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_case_createdAt", ["caseId", "createdAt"])
    .index("by_item_createdAt", ["protectedItemId", "createdAt"])
    .index("by_result", ["result"]),

  inboundAssignments: defineTable({
    workspaceId: v.id("workspaces"),
    agentmailMessageId: v.string(),
    agentmailThreadId: v.string(),
    fromDomain: v.union(v.string(), v.null()),
    subject: v.union(v.string(), v.null()),
    preview: v.union(v.string(), v.null()),
    receivedAt: v.number(),
    classification: inboundClassification,
    protectedItemId: v.union(v.id("protectedItems"), v.null()),
    caseId: v.union(v.id("cases"), v.null()),
    documentId: v.union(v.id("documents"), v.null()),
    assignmentStatus: v.union(v.literal("AUTO_ASSIGNED"), v.literal("NEEDS_ASSIGNMENT"), v.literal("ASSIGNED"), v.literal("IGNORED")),
    assignmentReason: v.union(v.string(), v.null()),
    processingStatus: v.union(v.literal("PENDING"), v.literal("PROCESSED"), v.literal("FAILED")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace_status", ["workspaceId", "assignmentStatus"])
    .index("by_workspace_receivedAt", ["workspaceId", "receivedAt"])
    .index("by_messageId", ["agentmailMessageId"])
    .index("by_threadId", ["agentmailThreadId"]),

  jobs: defineTable({
    workspaceId: v.id("workspaces"),
    protectedItemId: v.union(v.id("protectedItems"), v.null()),
    caseId: v.union(v.id("cases"), v.null()),
    type: v.string(),
    status: jobStatus,
    step: v.string(),
    progress: v.union(v.number(), v.null()),
    failureCode: v.union(v.string(), v.null()),
    safeMessage: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace_createdAt", ["workspaceId", "createdAt"])
    .index("by_item_createdAt", ["protectedItemId", "createdAt"])
    .index("by_status", ["status"]),

  auditEvents: defineTable({
    workspaceId: v.id("workspaces"),
    actorType: v.union(v.literal("USER"), v.literal("SYSTEM"), v.literal("WEBHOOK"), v.literal("DEMO")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.union(v.string(), v.null()),
    safeMetadataJson: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_workspace_createdAt", ["workspaceId", "createdAt"])
    .index("by_entity", ["entityType", "entityId"]),

  /** Safe telemetry for every external call (PRD 39). No content, no addresses. */
  externalCalls: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.null()),
    provider: v.union(v.literal("OPENAI"), v.literal("FIRECRAWL"), v.literal("AGENTMAIL")),
    operation: v.string(),
    status: v.union(v.literal("OK"), v.literal("ERROR")),
    errorCode: v.union(v.string(), v.null()),
    latencyMs: v.number(),
    attempt: v.number(),
    modelId: v.union(v.string(), v.null()),
    schemaVersion: v.union(v.string(), v.null()),
    externalRef: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_provider_createdAt", ["provider", "createdAt"]),

  evaluationRuns: defineTable({
    name: v.string(),
    mechanismVersion: v.string(),
    modelExtract: v.union(v.string(), v.null()),
    modelReason: v.union(v.string(), v.null()),
    condition: v.union(v.literal("FULL"), v.literal("NO_FIRECRAWL"), v.literal("NO_AGENTMAIL"), v.literal("NO_OPENAI"), v.literal("BASELINE")),
    status: v.union(v.literal("RUNNING"), v.literal("COMPLETE"), v.literal("FAILED")),
    startedAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    summaryJson: v.union(v.string(), v.null()),
  }).index("by_startedAt", ["startedAt"]),

  evaluationResults: defineTable({
    evaluationRunId: v.id("evaluationRuns"),
    fixtureId: v.string(),
    fixtureCategory: v.string(),
    expectedOutcome: v.string(),
    actualOutcome: v.string(),
    passed: v.boolean(),
    latencyMs: v.union(v.number(), v.null()),
    failureCode: v.union(v.string(), v.null()),
    metricsJson: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_run", ["evaluationRunId"])
    .index("by_run_passed", ["evaluationRunId", "passed"])
    .index("by_fixtureId", ["fixtureId"]),

  /** Sanitized, publicly inspectable execution records behind /proof/run/:runId. */
  proofRuns: defineTable({
    slug: v.string(),
    title: v.string(),
    kind: v.union(v.literal("LIVE"), v.literal("REPLAY"), v.literal("FIXTURE")),
    commitSha: v.union(v.string(), v.null()),
    payloadJson: v.string(),
    payloadSha256: v.string(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  demoSessions: defineTable({
    sessionKeyHash: v.string(),
    workspaceId: v.id("workspaces"),
    status: v.union(v.literal("ACTIVE"), v.literal("EXPIRED")),
    scenarioVersion: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_key", ["sessionKeyHash"])
    .index("by_expiresAt", ["expiresAt"]),

  productEvents: defineTable({
    workspaceId: v.union(v.id("workspaces"), v.null()),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_name_createdAt", ["name", "createdAt"]),
});
