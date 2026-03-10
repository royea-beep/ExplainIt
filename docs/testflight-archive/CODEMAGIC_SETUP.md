# Codemagic Setup — ExplainIt iOS Builds

All steps below are done from a browser on Windows. No Mac needed.

## Step 1 — Create Codemagic Account

1. Go to https://codemagic.io
2. Sign up with GitHub
3. Free tier: 500 build min/month (enough for ~16 iOS builds)

## Step 2 — Add the Repository

1. In Codemagic dashboard, click "Add application"
2. Select GitHub → authorize access
3. Select the `royea-beep/ExplainIt` repository
4. **Project type**: Select "Other / codemagic.yaml"
   - Codemagic will auto-detect `codemagic.yaml` in the repo root

## Step 3 — Connect App Store Connect

1. Go to **Teams** → your team → **Integrations**
2. Under "App Store Connect", click "Connect"
3. Enter the values from APPLE_SETUP.md:
   - **Issuer ID**: paste from App Store Connect
   - **Key ID**: paste from App Store Connect
   - **API Key**: upload the `.p8` file
4. Click Save

This enables:
- Automatic code signing (Codemagic creates provisioning profiles)
- Automatic TestFlight upload after successful build

## Step 4 — Set Environment Variables

In the Codemagic app settings, add these environment variables:

| Variable | Value | Secure |
|----------|-------|--------|
| `APP_STORE_APP_ID` | Your app's Apple ID (numeric, from App Store Connect) | No |

The `codemagic.yaml` handles everything else. No other env vars are needed.

## Step 5 — Trigger First Build

**Option A — Automatic (push to master)**:
```bash
git commit --allow-empty -m "chore: trigger first Codemagic build"
git push
```

**Option B — Manual**:
1. In Codemagic dashboard → your app → click "Start new build"
2. Select branch: `master`
3. Select workflow: `ios-testflight`
4. Click "Start new build"

## Step 6 — Monitor the Build

1. Build takes ~10-15 minutes
2. Watch the log in real-time in Codemagic dashboard
3. Each step shows pass/fail with full logs

### Expected build steps:
1. ✅ Install dependencies (`npm ci`)
2. ✅ Prepare webDir (`mkdir -p out`)
3. ✅ Sync Capacitor (`npx cap sync ios`)
4. ✅ Set up code signing (`xcode-project use-profiles`)
5. ✅ Increment build number
6. ✅ Build iOS (`xcode-project build-ipa`)
7. ✅ Upload to TestFlight

## Step 7 — Verify TestFlight Upload

1. Go to https://appstoreconnect.apple.com → your app → TestFlight
2. The new build should appear under "iOS Builds"
3. Apple processing takes 10-30 minutes
4. Once processed, testers in "Internal Testers" group get notified

## Adding TestFlight Testers

1. App Store Connect → your app → TestFlight → Internal Testing
2. Click "+" next to "Internal Testers"
3. Select Apple ID users (they must be in your App Store Connect team)
4. They'll receive a TestFlight invite email

For external testers (not in your team):
1. TestFlight → External Testing → create a group
2. Add email addresses
3. External testing requires a quick Beta App Review (usually <24h)

## Troubleshooting

### Build fails at "Install dependencies"
- Check that `package-lock.json` is committed and up to date
- Try `npm ci` locally to verify it works

### Build fails at "Sync Capacitor"
- Ensure `@capacitor/core` and `@capacitor/ios` are in `package.json`
- The `out/` directory is created automatically by the build script

### Build fails at "Set up code signing"
- Verify the API key has **Admin** role in App Store Connect
- Re-upload the `.p8` file to Codemagic
- Ensure `com.explainit.app` is registered in Apple Developer portal

### Build fails at "Build iOS"
- Check Xcode build logs in artifacts (`/tmp/xcodebuild_logs/*.log`)
- Most common: missing capability or entitlement
- The current app needs no special capabilities

### Build succeeds but TestFlight upload fails
- Verify App Store Connect API key permissions
- Check that the app exists in App Store Connect with matching bundle ID
- Ensure `APP_STORE_APP_ID` env var is set correctly

## Files Codemagic Uses

| File | Purpose |
|------|---------|
| `codemagic.yaml` | Build workflow definition |
| `capacitor.config.json` | App config (bundle ID, server URL) |
| `package.json` + `package-lock.json` | Dependencies |
| `ios/` directory | Xcode project |
