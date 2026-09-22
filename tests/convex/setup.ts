import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import { modules } from "../../convex/test.setup";

export function makeT() {
  const t = convexTest(schema, modules);
  return t;
}

export type TestConvex = ReturnType<typeof makeT>;

/** Creates a user plus onboarded workspace and returns an authenticated accessor. */
export async function signedInUser(t: TestConvex, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: `${userId}|test-session-${email}` });
  return { userId, as };
}
