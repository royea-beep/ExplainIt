# SecretSauce — ExplainIt

Security audit checklist: **keep sensitive logic server-side**. See [ZProjectManager/docs/SECRET_SAUCE_CHECKLIST.md](../../ZProjectManager/docs/SECRET_SAUCE_CHECKLIST.md) for the full checklist.

## Server-only (never in client)

- **ANTHROPIC_API_KEY** (if used for Smart Mode or future features) → env only; never `NEXT_PUBLIC_*`.
- **Playwright / Chromium** paths and **EXPORTS_DIR** → server/env only.
- Any **webhook secrets** or **API keys** for third-party integrations → env only.

## Current state

- `.env.example` documents `NEXT_PUBLIC_APP_URL`, `MAX_PIPELINES`, `EXPORTS_DIR`. No payment or billing yet.
- Ensure any new API keys (e.g. for auth or external APIs) are added to `.env.example` as server-only and never exposed to the client bundle.

## Before release

- Run `npx @royea/secret-sauce analyze ./src` if available; else use the shared checklist.
- Add audit logging for sensitive actions (e.g. pipeline runs, exports) if not already present.
