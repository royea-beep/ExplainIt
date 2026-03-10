# ExplainIt — TestFlight

## One Command

```bash
node scripts/build-day.js --values apple-values.local.json
```

## Docs

| Doc | What it's for |
|-----|---------------|
| **[TESTFLIGHT_QUICKSTART.md](./TESTFLIGHT_QUICKSTART.md)** | Step-by-step setup (Apple portal → Codemagic → first build) |
| **[TESTFLIGHT_FAILURE_MODES.md](./TESTFLIGHT_FAILURE_MODES.md)** | If build fails — triage by step name, log parsing, report template |
| **[APPLE_REVIEW_RISKS.md](./APPLE_REVIEW_RISKS.md)** | Billing risk for App Store (not needed for TestFlight beta) |
| **[APP_STORE_ASSETS.md](./APP_STORE_ASSETS.md)** | Icon/splash/screenshot replacement guide (post-beta) |

## Scripts

| Script | When to run |
|--------|-------------|
| `node scripts/build-day.js` | Before first build (repo + values check) |
| `node scripts/preflight-testflight.js` | After repo changes (repo-only check) |
| `node scripts/validate-apple-values.js` | After getting Apple values (values-only check) |

## Build Flow

```
git push origin master → Codemagic → npm ci → cap sync → sign → build → TestFlight
```

## Archived Docs

Historical setup docs superseded by TESTFLIGHT_QUICKSTART.md are in `docs/testflight-archive/`.
