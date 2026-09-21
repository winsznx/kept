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
import type * as http from "../http.js";
import type * as internal_agentmail from "../internal/agentmail.js";
import type * as lib_agentmail from "../lib/agentmail.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_evidence from "../lib/evidence.js";
import type * as lib_factCompare from "../lib/factCompare.js";
import type * as lib_hashing from "../lib/hashing.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_reconcile from "../lib/reconcile.js";
import type * as lib_schedule from "../lib/schedule.js";
import type * as lib_stateMachines from "../lib/stateMachines.js";
import type * as lib_urlSafety from "../lib/urlSafety.js";
import type * as protectedItems from "../protectedItems.js";
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
  http: typeof http;
  "internal/agentmail": typeof internal_agentmail;
  "lib/agentmail": typeof lib_agentmail;
  "lib/authz": typeof lib_authz;
  "lib/evidence": typeof lib_evidence;
  "lib/factCompare": typeof lib_factCompare;
  "lib/hashing": typeof lib_hashing;
  "lib/money": typeof lib_money;
  "lib/reconcile": typeof lib_reconcile;
  "lib/schedule": typeof lib_schedule;
  "lib/stateMachines": typeof lib_stateMachines;
  "lib/urlSafety": typeof lib_urlSafety;
  protectedItems: typeof protectedItems;
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
};
