# CLAUDE.md

Context for working on this repository. The README (in Lithuanian) is the authoritative design document and prototype guide; this file summarises it together with the coursework rules.

## Goal

This is a university coursework project for the course "Programų sistemų projektavimas" (Software Systems Design). The current stage is assignment II: a working prototype of the core module planned in the stage I design document (README sections 1-7). The student presents it live and must be able to explain every part of the code and make a small change on request, so the code has to stay easy to read and reason about.

The program, PiEmail (Priority information email), is a web app for small business owners. It reads new Gmail messages, filters out spam, promotions, newsletters and the user's own sent mail, uses an AI model to understand each remaining email, and turns emails that need action into Google Tasks reminders with a due date and priority. One email thread maps to exactly one task.

## Assignment II requirements

1. **Core function (1.5 pts).** At least one full user scenario from input to result with real processing and the business rules, plus meaningful error or conflict handling. Plain CRUD or precomputed output is not enough. If the core function does not work, the whole assignment scores 0.
2. **Code structure and quality (1.0).** Core logic separated from UI, storage and external services. Meaningful names, clear responsibilities, no duplicated logic. Use OOP, SOLID and design patterns only where they help.
3. **Automated tests (0.5).** At least 3 core module tests (normal, edge or conflict, and error case) that assert concrete expected results, plus at least 1 separate tenant isolation test. All tests must pass.
4. **Multitenancy (0.5).** At least two pre-seeded tenants with sample data. Tenant data must be clearly owned by a tenant, and isolation must be enforced by system logic, not just hidden in the UI. No self-registration or role system needed.
5. **Run and README (0.5).** README lists tools and versions, configuration, run and test commands, sample data and demo steps. The prototype must start with one documented command. Any API keys must be documented with an example config that contains no real keys.
6. **AI usage.** Validate the AI response and handle invalid responses and service errors. Tests may mock the AI; the live demo should show the real integration.

Out of scope for this stage (planned for stage III): login and roles, quality attribute evidence, per-tenant configuration, containerised deployment, polished design.

At the presentation: run the prototype, show the main scenario, the error case, tenant isolation and the test results.

## Architecture

```
React client (Vite) -> Express API (session) -> MailboxChecker -> analysis module -> SQLite
                            |                       |                 |
                      Google OAuth          Gmail / Google Tasks   classifier
                                            (real or mock)         (mock, Gemini, Claude)
```

- `src/analysis/` is the core module. It knows nothing about HTTP, the database or concrete services: it takes an email, a classifier and today's date and returns a result. It validates the AI response, scores priority, computes the task due date in working days and decides create / update / review / none. The rules are listed in README section 3 ("Taisyklės arba sprendimo žingsniai") and must match it.
- `src/ai/` is provider agnostic. Every classifier implements `classify(email, { today })`, returns the model's JSON answer and throws `AiServiceError` on any provider failure. `createClassifier.js` maps `AI_PROVIDER` to `MockClassifier` (keyword based, default, no key), `GeminiClassifier` (`@google/genai`, default `gemini-3.5-flash-lite`) or `ClaudeClassifier` (`@anthropic-ai/sdk`, default `claude-haiku-5-5`); `AI_MODEL` overrides the default. The prompt and JSON schema in `prompt.js` are shared. The response is still validated by `validateAiResponse`. A new provider is one class plus one registry entry.
- `src/auth/googleAuth.js` wraps the Google OAuth 2.0 flow (`google-auth-library`). Scopes: `openid`, `email`, `gmail.readonly`, `tasks`.
- `src/mailbox/` runs a mailbox check: fetch, filter, clean the body, analyse, apply the task decision, save. `MailboxChecker.check(tenant, { mail, tasks })` receives the tenant's clients per call. Failed analyses are retried on the next check.
- `src/integrations/` has the real Google clients (`GoogleGmailClient`, `GoogleTasksClient`, tasks go to a dedicated "PiEmail" list) and the mock ones persisted as JSON in `data/runtime/`. Both pairs have the same methods.
- `src/storage/` has the SQLite schema (built-in `node:sqlite`) and repositories. Every tenant-owned table has `tenant_id` in its primary key, and repository methods always take a tenant ID. Tenants have `auth_provider` `demo` or `google`.
- `src/http/app.js` has the Express routes. Login (`/auth/google`, `/auth/demo/:tenantId`) stores the tenant ID and Google tokens in a server-side `express-session`; there is no JWT. Tenant data routes are `/api/...` without a tenant ID: the tenant always comes from the session, so isolation is enforced on the server.
- `src/server.js` wires dependencies together and picks real or mock integrations per tenant. `client/` is the React UI (login page, dashboard).

Tenants: demo tenants are seeded from `data/seed/tenants.json` (mock inbox, demo login button); Google tenants are the accounts listed in `GOOGLE_ACCOUNTS`. There is no self-registration, unregistered Google accounts are refused.

Deviations from the stage I design, documented in README section 8: SQLite instead of PostgreSQL, checks run on demand while the user is signed in (tokens live only in the session), and demo tenants with a mocked Gmail and Google Tasks exist next to real Google tenants.

The design document scenarios happen in October 2026, so `APP_TODAY` in `.env` fixes "today" (for example `2026-10-05`, then `2026-10-07`) to replay them with the demo tenants. Leave it empty with real Gmail.

## Commands

Requires Node.js 22.13+ and npm 10+.

```bash
npm install
cp .env.example .env   # optional
npm start              # builds the client and serves everything on http://localhost:3000
node --env-file-if-exists=.env src/server.js   # API only, for use with npm run dev
npm run dev            # Vite dev server, proxies /api and /auth to port 3000
npm test               # Vitest
npm run reset          # deletes data/runtime, next start reloads the seed data (needed after schema changes)
```

Tests live in `test/`: `analysis.test.js` (core rules and AI validation), `mailboxChecker.test.js` (one task per thread, no duplicates, retries), `tenantIsolation.test.js` (session-scoped access, Google login with a fake `GoogleAuth`), `aiClassifiers.test.js` (the same contract run against each provider with fake SDK clients) and `googleGmailClient.test.js` (Gmail message mapping). They use in-memory SQLite and never call real Google, Gemini or Anthropic APIs. Run `npm test` after every change.

Seed data is in `data/seed/` with two demo tenants: `azuolo-baldai` and `kirpykla-zirkles`. Google Cloud setup steps are in README section 8 ("Google Cloud nustatymas").

## Conventions

- Write clean, readable, modern JavaScript (ES modules, `async`/`await`, small focused functions and classes).
- Do not overengineer. Prefer the simplest solution that meets the requirement; no extra abstraction layers, frameworks or dependencies without a clear need.
- No emojis anywhere. No AI-style comments: avoid comments that restate the code or narrate changes. Comment only where the reason is not obvious.
- Code, identifiers and comments are in English. User-facing text and the README are in Lithuanian; keep README section 8 in sync when behaviour, commands or configuration change.
- Never commit real API keys. `.env` is git-ignored; update `.env.example` when adding a setting.
- Any business rule change must be reflected in the README rules and covered by a test.