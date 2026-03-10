# TestFlight Quickstart — ExplainIt

One page. Everything you need. Follow top to bottom.

## Prerequisites

- [ ] Apple ID (personal is fine)
- [ ] Credit card for $99/year Apple Developer enrollment
- [ ] iPhone with TestFlight app installed

## Step 1 — Apple Developer Enrollment (~5 min)

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with Apple ID
3. Enroll as **Individual** → pay $99/year
4. Wait for approval (usually instant, can take 48h)

**If stuck**: enrollment pending > 48h → contact Apple Developer support via the enrollment page.

## Step 2 — Register Bundle ID (~2 min)

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click **+** → **App IDs** → **App** → Continue
3. Description: `ExplainIt`
4. Bundle ID: **Explicit** → `com.explainit.app`
5. Capabilities: leave defaults (none needed)
6. Continue → Register

**Common mistake**: selecting "Wildcard" instead of "Explicit". Must be Explicit.

## Step 3 — Create App in App Store Connect (~3 min)

1. Go to https://appstoreconnect.apple.com/apps
2. Click **+** → **New App**
3. Fill exactly:
   - Platforms: **iOS**
   - Name: **ExplainIt**
   - Primary Language: **English (U.S.)**
   - Bundle ID: select **com.explainit.app** from dropdown
   - SKU: **explainit-ios**
   - User Access: **Full Access**
4. Click **Create**
5. On the app page, find **Apple ID** (top of General section) — it's a number like `6741234567`
6. **Write it down.** This is your `APP_STORE_APP_ID`.

**Common mistake**: the "Apple ID" here is NOT your email. It's a numeric ID specific to this app.

## Step 4 — Generate API Key (~2 min)

1. Go to https://appstoreconnect.apple.com/access/integrations/api
2. Click **Generate API Key** (or **+** if you already have keys)
3. Name: **Codemagic**
4. Access: **Admin** (not Developer, not App Manager — must be Admin)
5. Click **Generate**
6. **Download the .p8 file immediately.** You cannot download it again.
7. Note these values (visible on the page):
   - **Issuer ID**: UUID at top of page (same for all keys)
   - **Key ID**: 10-char string next to key name

**Write down all three: .p8 file location, Issuer ID, Key ID.**

## Step 5 — Create TestFlight Beta Group (~1 min)

1. Go to App Store Connect → your app → **TestFlight**
2. Click **+** next to "Internal Testing" (left sidebar)
3. Group name: **Internal Testers** (exact spelling — Codemagic config references this name)
4. Add yourself as a tester (select your Apple ID user)

**Why now**: Codemagic's `beta_groups: ["Internal Testers"]` publishes to this exact group. Without it, upload succeeds but nobody gets notified.

## Step 6 — Validate Your Values (~1 min)

```bash
cp apple-values.template.json apple-values.local.json
# Edit apple-values.local.json with your 4 values from Steps 3-4
node scripts/build-day.js --values apple-values.local.json
```

This single command checks both repo readiness (28 checks) and Apple value formats. It catches:
- APP_STORE_APP_ID that's not numeric (common: pasting Key ID instead)
- KEY_ID that's not exactly 10 uppercase alphanumeric characters
- ISSUER_ID that's not UUID format
- .p8 filename that doesn't match Apple convention
- Mismatched Key ID vs .p8 filename

## Step 7 — Connect Codemagic (~5 min)

1. Go to https://codemagic.io → sign up with GitHub
2. **Add application** → select **royea-beep/ExplainIt**
3. Project type: **Other / codemagic.yaml**

### 7a — App Store Connect Integration (team-level, one-time)

4. Go to **Teams** → your team → **Integrations**
5. Under "App Store Connect" → click **Connect**
6. Paste **Issuer ID** (UUID from Step 4)
7. Paste **Key ID** (10-char from Step 4)
8. Upload the **.p8 file** (from Step 4)
9. Click **Save**

### 7b — Environment Variable (app-level)

10. Go to your app → **Environment variables**
11. Click **Add variable**
12. Name: `APP_STORE_APP_ID`
13. Value: the numeric Apple ID from Step 3 (e.g. `6741234567`)
14. Secure: **No**
15. Click **Add**

### 7c — Verify before continuing

Before triggering the build, confirm these in Codemagic UI:

- [ ] Teams → Integrations → App Store Connect shows **Connected** (green) with your Issuer ID
- [ ] Your app → Environment variables shows `APP_STORE_APP_ID` with a numeric value
- [ ] Your app → Build configuration shows `codemagic.yaml` detected (not "Workflow Editor")

## Step 8 — Trigger First Build (~1 min)

**Recommended for first build** (doesn't depend on webhook setup):

1. Codemagic dashboard → your app → **Start new build**
2. Branch: `master`
3. Workflow: `ios-testflight`
4. Click **Start new build**

**For all future builds** (after webhook is confirmed working):
```bash
git push origin master
```

## Step 9 — Monitor (~10-15 min)

Watch in Codemagic dashboard. Expected steps in order:

| # | Step | ~Time | What to watch |
|---|------|-------|---------------|
| 1 | Install dependencies | 1-2 min | `npm ci` OK |
| 2 | Prepare webDir | <5 sec | `mkdir -p out` OK |
| 3 | Sync Capacitor | 30-60s | No "webDir not found" |
| 4 | Code signing | 30-60s | `xcode-project use-profiles` finds profile |
| 5 | Build number | <10s | Shows new number |
| 6 | Build iOS | 3-8 min | `.ipa` created |
| 7 | Publish | 1-2 min | "Published to App Store Connect" |

**If any step fails**: see TESTFLIGHT_FAILURE_MODES.md — find by step name, use the failure report template at the bottom.

## Step 10 — Verify on iPhone (~30 min wait)

1. App Store Connect → your app → TestFlight → iOS Builds
2. Build appears as **Processing** (10-30 min)
3. Status changes to **Ready to Test**
4. TestFlight app on iPhone → ExplainIt appears → Install
5. App opens → loads from explainit-one.vercel.app

**If app shows blank screen**: the Vercel deployment is down, not an app issue. Check URL in Safari first.

**If the app loads and you can navigate** → first TestFlight build is complete. You're done.

---

## Cheat Sheet — Where Each Value Goes

| Value | From | To |
|-------|------|-----|
| APP_STORE_APP_ID | App Store Connect → app → General | Codemagic → App → Env Vars |
| Issuer ID | App Store Connect → Integrations → API | Codemagic → Teams → Integrations |
| Key ID | App Store Connect → Integrations → API | Codemagic → Teams → Integrations |
| .p8 file | Downloaded once from API key page | Codemagic → Teams → Integrations (upload) |

## If Build Fails — Decision Tree

```
Which step failed?
├── "Install dependencies" → npm ci issue → run npm ci locally to reproduce
├── "Sync Capacitor" → mkdir missing → check codemagic.yaml step order
├── "Code signing" → 90% chance: .p8 not uploaded or bundle ID not registered
├── "Build iOS" → check Xcode log artifact for "error:" lines
├── "Publish" → app not in App Store Connect, or APP_STORE_APP_ID wrong
└── Build OK but no TestFlight → wait 30 min, check email for compliance notice
```
