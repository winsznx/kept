# Docs snapshot

What Kept relies on, checked against current official docs and published package source on 2026-09-21. Re-check a section when an integration error suggests the API moved.

## Event

- Source: https://www.convex.dev/hackathons/all-gas
- Deadline: September 22, 12:00 PM PT, submitted via https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit
- Eligibility: new apps started on or after August 25, 12 PM PT. Kept's first commit is dated 2026-09-21.
- Requirements used by Kept: Convex backend; Firecrawl doing real crawling work; AgentMail actively sending; OpenAI generating real content; public app on `convex.site`; social post tagging @convex, @OpenAI, @firecrawl, @agentmail; video under 3 minutes; `hackathon.md` maintained with the official skill.

## Convex

| Package | Version | Used for |
|---|---|---|
| `convex` | 1.46.0 | backend, React client |
| `@convex-dev/auth` | 0.0.95 (+ `@auth/core` 0.41.3) | Password auth |
| `@convex-dev/static-hosting` | 0.2.1 | SPA hosting on `*.convex.site` |
| `convex-test` | 0.0.59 | function tests (with `vitest` 4.x, `@edge-runtime/vm`) |

- Auth: `convexAuth({ providers: [Password] })` in `convex/auth.ts`; `auth.addHttpRoutes(http)` registers `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/api/auth/*`. These must stay at the site root because the JWT issuer is `CONVEX_SITE_URL`. Env: `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, set per deployment (dev and prod separately). `getAuthUserId(ctx)` reads `identity.subject.split("|")[0]`.
- Static hosting: app-owned root mode (`app.use(staticHosting)` with no `httpPrefix`), `registerStaticRoutes(http, components.staticHosting)` registered last as a GET `/` prefix catch-all, SPA fallback on by default. `npx @convex-dev/static-hosting deploy` spawns `convex deploy` without `--yes`, which crashes non-interactively, so Kept deploys with `npx convex deploy -y` followed by `npx @convex-dev/static-hosting upload --build --prod`.
- File storage: `ctx.storage.generateUploadUrl()` (mutation), `ctx.storage.store/get` (actions only), metadata via `ctx.db.system.get("_storage", id)` with `sha256` (hex), `size`, `contentType`.
- Scheduling: `ctx.scheduler.runAfter(ms, internal.fn, args)`, atomic with the enclosing mutation. Crons via `cronJobs()` in `convex/crons.ts`.
- Testing: `convexTest(schema, modules)` with `import.meta.glob`; authenticated calls via `t.withIdentity({ subject: \`${userId}|session\` })`.
- CLI (non-interactive): `npx convex dev --once --configure new --team <slug> --project kept --dev-deployment cloud`; `npx convex env set -- NAME value`; `npx convex deploy -y`.

## Firecrawl

| Package | Version |
|---|---|
| `@firecrawl/firecrawl-convex` | 0.1.1 (needs convex >= 1.43 for typed component env) |

- Registration: `defineApp({ env: { FIRECRAWL_API_KEY: v.string() } })` and `app.use(firecrawl, { env: { FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY } })`.
- `new FirecrawlClient(components.firecrawl)`; `scrape(ctx, url, opts)` and `search(ctx, query, opts)` are synchronous single calls from actions returning the raw v2 `data`.
- Kept scrapes with `formats: ["markdown"]`, `onlyMainContent: true`, `maxAge: 0`, `storeInCache: false` so each capture is fresh. `metadata` exposes `title`, `sourceURL`, `url`, `statusCode`, `cacheState`, `creditsUsed`.
- Errors surface as `ConvexError({ code, status, path, message })`; 402 = credits exhausted (no retry), 429/5xx retried 3x by the component. A 200 can wrap a target-site 4xx, so Kept checks `metadata.statusCode`.
- `FIRECRAWL_WEBHOOK_SECRET` is only for crawl webhooks; Kept doesn't crawl, so it isn't used.

## AgentMail

| Package | Version |
|---|---|
| `@agentmail/convex` | 0.1.0 |
| REST API | `https://api.agentmail.to/v0` |

- Webhooks: the component's `handleWebhook(ctx, req)` verifies Svix signatures (`svix-id`, `svix-timestamp`, `svix-signature`) against `AGENTMAIL_WEBHOOK_SECRET`, dedupes on `event_id` in one mutation, stores `inboundMessages` (incl. `extractedText`), then calls the app's `onMessageReceived({ message, thread, eventId })`.
- The component accepts only `message.received`, `.sent`, `.delivered`, `.bounced`, `.complained`, `.rejected`, `domain.verified`. Subscribing to other types makes its handler 500, so Kept's webhook subscribes only to those.
- Inbox creation: `POST /inboxes` with `client_id`; repeating the `client_id` returns the original inbox (idempotent).
- Send/reply: `POST /inboxes/{id}/messages/send` and `/messages/{mid}/reply` with an `Idempotency-Key` header; a repeated key returns the original `message_id`/`thread_id` and sends nothing (keys live 24h).
- Attachments: `GET /inboxes/{id}/messages/{mid}/attachments/{aid}` returns an expiring `download_url`; Kept copies bytes into Convex storage.
- Plan limits: free plan is 3 inboxes / 3,000 emails per month.

## OpenAI

| Package | Version |
|---|---|
| `openai` | 7.20.0 (zod peer `^3.25 || ^4`) |

- Models (developers.openai.com model pages): `gpt-5.6-terra` (cost-balanced, Structured Outputs, image input) is `OPENAI_MODEL_EXTRACT`; `gpt-5.6-sol` is `OPENAI_MODEL_REASON`. `gpt-6-astra` is the current flagship and is not needed for Kept's workload.
- Responses API with strict Structured Outputs: `client.responses.parse({ model, input, text: { format: zodTextFormat(Schema, "name") }, store: false })`, result in `output_parsed`.
- Strict-schema rules: root must be an object; every property required; optional values modelled as `.nullable()`; `additionalProperties: false`; nested discriminated unions become `anyOf`; avoid `minLength`/`maxLength`.
- PDF input: `{ type: "input_file", filename, file_data: "data:application/pdf;base64,..." }`. Image input: `{ type: "input_image", image_url: "data:image/...;base64,...", detail: "auto" }`.
- Refusal arrives as a `refusal` content item with `output_parsed === null`; `status === "incomplete"` is also a failure. `store: false` keeps request data out of OpenAI's 30-day response storage.
