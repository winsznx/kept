import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Static SPA catch-all must be registered last so exact routes above keep priority.
registerStaticRoutes(http, components.staticHosting);

export default http;
