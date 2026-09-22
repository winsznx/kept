import { AgentMail } from "@agentmail/convex";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.inbound.onMessageReceived,
  onEvent: internal.cases.onAgentMailEvent,
});

type WebhookCtx = Parameters<typeof agentmail.handleWebhook>[0];

// Svix signature verification and event_id dedupe happen inside the component.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // SDK boundary: @agentmail/convex types runMutation with the newer (args, options)
    // signature; httpAction's runMutation takes (args). The component never passes options.
    const webhookCtx = { runMutation: ((ref: Parameters<typeof ctx.runMutation>[0], args: Parameters<typeof ctx.runMutation>[1]) => ctx.runMutation(ref, args)) as unknown as WebhookCtx["runMutation"] };
    return await agentmail.handleWebhook(webhookCtx, req);
  }),
});

// Static SPA catch-all must be registered last so exact routes above keep priority.
registerStaticRoutes(http, components.staticHosting);

export default http;
