# First TestFlight Build — Execution Checklist

## Before Anything
- [ ] Verify Apple Developer enrollment is active at developer.apple.com/account
- [ ] Verify you can access App Store Connect at appstoreconnect.apple.com

## Apple Developer Portal
- [ ] Go to developer.apple.com → Certificates, Identifiers & Profiles → Identifiers
- [ ] Click "+" → App IDs → App
- [ ] Description: `ExplainIt`
- [ ] Bundle ID: Explicit → `com.explainit.app`
- [ ] Click Continue → Register

## App Store Connect
- [ ] Go to appstoreconnect.apple.com → My Apps → "+"  → New App
- [ ] Platform: **iOS**
- [ ] Name: **ExplainIt**
- [ ] Primary Language: **English (U.S.)**
- [ ] Bundle ID: select **com.explainit.app**
- [ ] SKU: **explainit-ios**
- [ ] User Access: **Full Access**
- [ ] Click **Create**
- [ ] Copy the **Apple ID** (numeric, shown on app page) → save it

## App Store Connect API Key
- [ ] Go to Users and Access → Integrations → App Store Connect API
- [ ] Click "+" to generate new key
- [ ] Name: **Codemagic**
- [ ] Access: **Admin**
- [ ] Click **Generate**
- [ ] **Download the .p8 file immediately** (one-time only!)
- [ ] Copy the **Key ID** (shown next to key name)
- [ ] Copy the **Issuer ID** (shown at top of page)

## Codemagic Setup
- [ ] Go to codemagic.io → sign up / sign in with GitHub
- [ ] Click "Add application" → select GitHub → `royea-beep/ExplainIt`
- [ ] Project type: **Other / codemagic.yaml**
- [ ] Go to **Teams** → your team → **Integrations**
- [ ] Under App Store Connect → click **Connect**
- [ ] Enter **Issuer ID**
- [ ] Enter **Key ID**
- [ ] Upload the **.p8 file**
- [ ] Click **Save**
- [ ] Go to your app → **Environment variables**
- [ ] Add variable: name = `APP_STORE_APP_ID`, value = the numeric Apple ID
- [ ] Secure: **No**

## Trigger Build
- [ ] Option A: Push to master
  ```bash
  git commit --allow-empty -m "chore: trigger first Codemagic build"
  git push
  ```
- [ ] Option B: Codemagic dashboard → Start new build → branch `master` → workflow `ios-testflight`

## After Build Starts (~15 min)
- [ ] Watch build log in Codemagic dashboard
- [ ] Verify each step passes: npm ci → webDir → cap sync → signing → build → upload
- [ ] If build fails: check exact failing step, refer to TESTFLIGHT_FAILURE_MODES.md

## After Successful Upload
- [ ] Go to App Store Connect → your app → TestFlight
- [ ] Wait for Apple processing (10-30 minutes)
- [ ] Build appears under "iOS Builds"
- [ ] Status changes from "Processing" to "Ready to Test"
- [ ] Add yourself as internal tester if not already added
- [ ] Open TestFlight app on iPhone → install ExplainIt
