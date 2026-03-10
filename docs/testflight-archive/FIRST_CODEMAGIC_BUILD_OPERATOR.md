# First Codemagic Build — Operator Runbook

## Purpose

Step-by-step operator playbook for triggering the first real Codemagic iOS build and getting ExplainIt into TestFlight. Assumes Apple portal setup is complete (see FIRST_TESTFLIGHT_BUILD_CHECKLIST.md if not).

## Inputs Required Before Pressing Build

All of these must already be configured in Codemagic:

- [ ] App Store Connect API key (`.p8` file) uploaded in Codemagic → Teams → Integrations
- [ ] Issuer ID entered in same integration panel
- [ ] Key ID entered in same integration panel
- [ ] `APP_STORE_APP_ID` set as environment variable in Codemagic app settings
- [ ] "Internal Testers" beta group exists in App Store Connect → TestFlight

Verify with: `node scripts/preflight-testflight.js` (checks repo-side readiness).

## Exact Codemagic Steps

### Option A: Push-triggered (recommended)

1. Run preflight: `node scripts/preflight-testflight.js`
2. Confirm all checks pass
3. Push to master:
   ```bash
   git commit --allow-empty -m "chore: trigger first Codemagic build"
   git push origin master
   ```
4. Open Codemagic dashboard → your app → watch build start
5. Go to step "Monitor the Build"

### Option B: Manual trigger

1. Open codemagic.io → your app
2. Click **Start new build**
3. Branch: `master`
4. Workflow: `ios-testflight`
5. Click **Start new build**
6. Go to step "Monitor the Build"

## Monitor the Build

Watch each step in order. If any fails, stop and check [TESTFLIGHT_FAILURE_MODES.md](./TESTFLIGHT_FAILURE_MODES.md).

| Step | Expected Duration | What to Watch |
|------|------------------|---------------|
| Install dependencies | 1-2 min | `npm ci` completes without errors |
| Prepare webDir | < 5 sec | `mkdir -p out` succeeds |
| Sync Capacitor iOS | 30-60 sec | `npx cap sync ios` completes, no "webDir not found" |
| Set up code signing | 30-60 sec | `xcode-project use-profiles` finds provisioning profile |
| Increment build number | < 10 sec | Shows new build number |
| Build iOS | 3-8 min | `xcode-project build-ipa` completes, .ipa created |
| Publish | 1-2 min | "Published to App Store Connect" message |

**Total expected: 8-15 minutes**

## What Success Looks Like

### In Codemagic
- All steps show green checkmarks
- Build status: **Success**
- Artifacts section shows `.ipa` file
- Publishing section shows "Published to App Store Connect"
- Email arrives at royearguan@gmail.com confirming success

### In App Store Connect
- Go to appstoreconnect.apple.com → your app → TestFlight
- A new build appears under "iOS Builds"
- Status: **Processing** (immediately after upload)
- Status changes to: **Ready to Test** (after 10-30 minutes)

### In TestFlight App (iPhone)
- Open TestFlight app on your iPhone
- ExplainIt appears in available apps
- Tap **Install**
- App opens and loads the web app from explainit-one.vercel.app

## What to Do If Build Fails

1. Note the **exact step name** that failed (shown in Codemagic build log)
2. Open [TESTFLIGHT_FAILURE_MODES.md](./TESTFLIGHT_FAILURE_MODES.md)
3. Find the matching failure mode by step name

**Triage order** (most likely first-build failures):
1. **Signing fails** → API key not uploaded or bundle ID not registered
2. **npm ci fails** → package-lock.json out of sync
3. **Build fails** → SPM version mismatch
4. **Upload fails** → App not created in App Store Connect

**What to bring back for debugging:**
- The failing step name
- Last 30 lines of that step's log output
- See [TESTFLIGHT_BUILD_LOG_PARSER.md](./TESTFLIGHT_BUILD_LOG_PARSER.md) for exactly what to copy

## What to Do If Build Succeeds

1. **Verify in App Store Connect** (immediately):
   - Go to TestFlight → iOS Builds
   - Confirm build appears with status "Processing"

2. **Wait for Apple processing** (10-30 min, can be longer for first build):
   - Status changes from "Processing" to "Ready to Test"
   - If stuck >1 hour: check email for Apple compliance notices

3. **Install on iPhone**:
   - Open TestFlight app
   - Tap ExplainIt → Install
   - Launch the app

4. **First smoke test**:
   - App loads (not blank white screen)
   - Can navigate the web app
   - Bottom safe area doesn't overlap content
   - Can scroll and interact normally

5. **If app shows blank screen**:
   - Check that https://explainit-one.vercel.app loads in Safari on the same device
   - This means the Vercel deployment is down, not an app issue
