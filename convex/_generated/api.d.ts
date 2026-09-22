/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as cases from "../cases.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as fixtures_canonical from "../fixtures/canonical.js";
import type * as fixtures_fixtureParser from "../fixtures/fixtureParser.js";
import type * as http from "../http.js";
import type * as inbound from "../inbound.js";
import type * as internal_agentmail from "../internal/agentmail.js";
import type * as internal_ai from "../internal/ai.js";
import type * as internal_caseSend from "../internal/caseSend.js";
import type * as internal_demoSeed from "../internal/demoSeed.js";
import type * as internal_evalActions from "../internal/evalActions.js";
import type * as internal_harness from "../internal/harness.js";
import type * as internal_inboundProcessing from "../internal/inboundProcessing.js";
import type * as internal_ingest from "../internal/ingest.js";
import type * as internal_sourceProcessing from "../internal/sourceProcessing.js";
import type * as items from "../items.js";
import type * as lib_agentmail from "../lib/agentmail.js";
import type * as lib_aiPrompts from "../lib/aiPrompts.js";
import type * as lib_aiSchemas from "../lib/aiSchemas.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_cascade from "../lib/cascade.js";
import type * as lib_casePacket from "../lib/casePacket.js";
import type * as lib_evidence from "../lib/evidence.js";
import type * as lib_factCompare from "../lib/factCompare.js";
import type * as lib_hashing from "../lib/hashing.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_pipeline from "../lib/pipeline.js";
import type * as lib_reconcile from "../lib/reconcile.js";
import type * as lib_schedule from "../lib/schedule.js";
import type * as lib_stateMachines from "../lib/stateMachines.js";
import type * as lib_urlSafety from "../lib/urlSafety.js";
import type * as proof from "../proof.js";
import type * as protectedItems from "../protectedItems.js";
import type * as sources from "../sources.js";
import type * as staticHosting from "../staticHosting.js";
import type * as telemetry from "../telemetry.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  cases: typeof cases;
  crons: typeof crons;
  demo: typeof demo;
  "fixtures/canonical": typeof fixtures_canonical;
  "fixtures/fixtureParser": typeof fixtures_fixtureParser;
  http: typeof http;
  inbound: typeof inbound;
  "internal/agentmail": typeof internal_agentmail;
  "internal/ai": typeof internal_ai;
  "internal/caseSend": typeof internal_caseSend;
  "internal/demoSeed": typeof internal_demoSeed;
  "internal/evalActions": typeof internal_evalActions;
  "internal/harness": typeof internal_harness;
  "internal/inboundProcessing": typeof internal_inboundProcessing;
  "internal/ingest": typeof internal_ingest;
  "internal/sourceProcessing": typeof internal_sourceProcessing;
  items: typeof items;
  "lib/agentmail": typeof lib_agentmail;
  "lib/aiPrompts": typeof lib_aiPrompts;
  "lib/aiSchemas": typeof lib_aiSchemas;
  "lib/authz": typeof lib_authz;
  "lib/cascade": typeof lib_cascade;
  "lib/casePacket": typeof lib_casePacket;
  "lib/evidence": typeof lib_evidence;
  "lib/factCompare": typeof lib_factCompare;
  "lib/hashing": typeof lib_hashing;
  "lib/money": typeof lib_money;
  "lib/openai": typeof lib_openai;
  "lib/pipeline": typeof lib_pipeline;
  "lib/reconcile": typeof lib_reconcile;
  "lib/schedule": typeof lib_schedule;
  "lib/stateMachines": typeof lib_stateMachines;
  "lib/urlSafety": typeof lib_urlSafety;
  proof: typeof proof;
  protectedItems: typeof protectedItems;
  sources: typeof sources;
  staticHosting: typeof staticHosting;
  telemetry: typeof telemetry;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
};
