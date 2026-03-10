# ExplainIt — TestFlight Deployment Guide

## Current State

| Item | Status |
|------|--------|
| Capacitor iOS project | `ios/` directory with `App.xcodeproj` ✅ |
| Remote URL mode | WebView loads `https://explainit-one.vercel.app` ✅ |
| Bundle ID | `com.explainit.app` (consistent across Capacitor, Xcode, Codemagic) ✅ |
| Capacitor version | 8.2.0, iOS 15+ target ✅ |
| App icon | 1024x1024 PNG (real, not placeholder) ✅ |
| Splash screen | 2732x2732 PNG at 1x/2x/3x ✅ |
| Codemagic config | `codemagic.yaml` with full build pipeline ✅ |
| Build number | Auto-incremented by Codemagic ✅ |
| No local Mac needed | All builds via Codemagic cloud ✅ |
| Preflight check | `node scripts/preflight-testflight.js` — 30/30 ✅ |

## Quick Start

**Start here → [TESTFLIGHT_QUICKSTART.md](./TESTFLIGHT_QUICKSTART.md)** — single page, top to bottom, ~20 min.

```bash
# 1. Verify repo is ready
node scripts/preflight-testflight.js

# 2. After Apple portal setup, validate your values
node scripts/validate-apple-values.js --values apple-values.local.json

# 3. After Codemagic setup, trigger build
git push origin master
```

**Reference docs** (only if quickstart doesn't cover your situation):
[APPLE_VALUES.md](./APPLE_VALUES.md) | [CODEMAGIC_SECRETS_MAP.md](./CODEMAGIC_SECRETS_MAP.md) | [TESTFLIGHT_FAILURE_MODES.md](./TESTFLIGHT_FAILURE_MODES.md) | [TESTFLIGHT_BUILD_LOG_PARSER.md](./TESTFLIGHT_BUILD_LOG_PARSER.md) | [APP_STORE_ASSETS.md](./APP_STORE_ASSETS.md) | [APPLE_REVIEW_RISKS.md](./APPLE_REVIEW_RISKS.md)

## What Happens on Each Push

```
git push origin master
    ↓
Codemagic detects push (via codemagic.yaml trigger)
    ↓
npm ci → mkdir out → npx cap sync ios → code signing → xcodebuild → .ipa
    ↓
Upload to App Store Connect → TestFlight processing (10-30 min)
    ↓
Internal testers get notified via TestFlight app
```

## Platform Split

### From Windows (browser)
- Apple Developer enrollment
- App Store Connect: create app, register bundle ID, generate API key
- Codemagic: connect repo, upload API key, monitor builds
- Code changes + `git push`
- Add/remove TestFlight testers
- View crash logs and feedback

### Handled by Codemagic (cloud macOS)
- `xcodebuild` compilation
- Code signing with auto-generated provisioning profiles
- `.ipa` generation
- TestFlight upload via App Store Connect API
- Swift Package Manager dependency resolution

### Local Mac Required
- Nothing. The entire pipeline runs without a Mac.

## Billing / Apple Review

See **[APPLE_REVIEW_RISKS.md](./APPLE_REVIEW_RISKS.md)** for full analysis.

**Short version**: LemonSqueezy works fine for TestFlight beta. Public App Store would need StoreKit or web-only billing.

## Known Limitations

- **App icon**: Single 1024x1024 asset. Modern Xcode auto-generates all sizes from this. If build fails on icon validation, generate a full icon set at appicon.co.
- **webDir "out"**: Doesn't exist locally. Codemagic creates it during build. For local `cap sync`, run `mkdir -p out` first.
- **No push notifications**: Not configured. Would need APNs + Capacitor push plugin.
- **Portrait-only**: Info.plist locked to portrait on iPhone (iPad keeps all orientations for compatibility).

## Troubleshooting

See **[CODEMAGIC_SETUP.md](./CODEMAGIC_SETUP.md)** for build troubleshooting.

### App shows blank/white screen
- Verify `https://explainit-one.vercel.app` is deployed
- Check `capacitor.config.json` → `server.url`
- iOS requires HTTPS (already configured)

### TestFlight build not appearing
- Apple processing takes 10-30 min after upload
- Check App Store Connect → TestFlight for status
- Ensure at least one internal tester exists in "Internal Testers" group
