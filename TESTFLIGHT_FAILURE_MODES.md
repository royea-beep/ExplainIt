# TestFlight First Build — Failure Modes & Fixes

## 1. "npm ci" fails

**Symptom**: Build fails at "Install dependencies" step.
**Cause**: `package-lock.json` is out of sync with `package.json`, or a dependency requires a newer Node version.
**Where**: Codemagic build log, first script step.
**Fix**: Run `npm ci` locally. If it fails, run `npm install` and commit the updated `package-lock.json`. The Codemagic config uses Node 20.

## 2. "cap sync" fails with "webDir not found"

**Symptom**: `npx cap sync ios` fails because `out/` directory doesn't exist.
**Cause**: This shouldn't happen — `codemagic.yaml` creates `out/` in the previous step. If it still fails, the step ordering was changed.
**Where**: "Sync Capacitor iOS" step.
**Fix**: Verify `codemagic.yaml` has the "Prepare webDir" step before "Sync Capacitor".

## 3. Code signing fails — "No provisioning profiles found"

**Symptom**: `xcode-project use-profiles` fails.
**Cause**: App Store Connect API key wasn't uploaded to Codemagic, or doesn't have Admin role, or bundle ID `com.explainit.app` isn't registered in Apple Developer portal.
**Where**: "Set up code signing" step.
**Fix**:
1. Verify bundle ID is registered at developer.apple.com → Identifiers
2. Verify API key has **Admin** access in App Store Connect
3. Re-upload `.p8` file in Codemagic → Teams → Integrations

## 4. Build fails — "No signing certificate"

**Symptom**: xcodebuild fails with signing errors.
**Cause**: Same root cause as #3. Codemagic creates certificates automatically from the API key — if the key is wrong or missing, no certificate is created.
**Where**: "Build iOS" step.
**Fix**: Same as #3.

## 5. Build fails — Xcode compilation error

**Symptom**: xcodebuild fails with Swift/compile errors.
**Cause**: SPM dependency resolution failed, or Capacitor version mismatch.
**Where**: "Build iOS" step, in xcodebuild output.
**Fix**: Check the Xcode build log artifact at `/tmp/xcodebuild_logs/*.log`. Most likely: `capacitor-swift-pm` version in `Package.swift` doesn't match `@capacitor/ios` in `package.json`. Both should be 8.2.x.

## 6. Build succeeds but TestFlight upload fails

**Symptom**: `.ipa` is created but "Publishing to App Store Connect" fails.
**Cause**: App doesn't exist in App Store Connect, or bundle ID doesn't match, or API key permissions are insufficient.
**Where**: Codemagic publishing step.
**Fix**:
1. Verify app exists in App Store Connect with bundle ID `com.explainit.app`
2. Verify API key has Admin role
3. Check that `APP_STORE_APP_ID` matches the Apple ID shown in App Store Connect

## 7. Upload succeeds but build doesn't appear in TestFlight

**Symptom**: Codemagic says "Published to App Store Connect" but nothing in TestFlight.
**Cause**: Apple is still processing. This takes 10-30 minutes, sometimes longer for first builds.
**Where**: App Store Connect → TestFlight.
**Fix**: Wait. Check App Store Connect → TestFlight → "iOS Builds". The build will show as "Processing". If stuck >1 hour, check for email from Apple about compliance issues (rare for first build).

## 8. Build number conflict — "already exists"

**Symptom**: Upload fails with "A build with this version and build number already exists".
**Cause**: `APP_STORE_APP_ID` env var not set, so build number defaults to 1 on every build.
**Where**: Codemagic publishing step.
**Fix**: Set `APP_STORE_APP_ID` environment variable in Codemagic. The `agvtool` step uses it to auto-increment. For immediate fix: manually set a higher build number in `ios/App/App.xcodeproj/project.pbxproj` (`CURRENT_PROJECT_VERSION`).

## 9. "beta group not found" warning

**Symptom**: Build uploads but Codemagic warns about "Internal Testers" beta group not found.
**Cause**: No beta group named "Internal Testers" exists in App Store Connect.
**Where**: Codemagic publishing step (warning, not failure).
**Fix**: In App Store Connect → TestFlight → create a group called exactly "Internal Testers" and add yourself.

## 10. App opens to blank white screen on device

**Symptom**: TestFlight install works, app launches but shows white/blank.
**Cause**: The WebView can't reach `https://explainit-one.vercel.app` — either Vercel is down or there's a network issue.
**Where**: On the physical device.
**Fix**: Verify the URL is accessible in Safari on the same device. Check Vercel deployment status. The `capacitor.config.json` `server.url` must be `https://explainit-one.vercel.app`.

---

## How to Read Codemagic Build Logs

### What to search for by step

| Failed step | Search log for | Meaning |
|------------|----------------|---------|
| Install dependencies | `npm ERR!`, `ERESOLVE` | Dependency issue |
| Sync Capacitor | `webDir "out" not found` | mkdir step missing |
| Code signing | `No provisioning profiles`, `Authentication failed`, `401` | API key issue |
| Build iOS | `error:`, `Swift Compiler Error`, `missing package product` | Xcode/SPM issue |
| Publish | `ERROR ITMS-`, `already exists`, `No suitable application records` | Upload issue |

### Where to find Xcode logs

Codemagic saves full Xcode build logs as artifacts → download from Artifacts section → `/tmp/xcodebuild_logs/*.log` → search for `error:`.

---

## Failure Report Template

When reporting a failed build, copy this template and fill it in:

```
BUILD FAILURE REPORT
====================
Step that failed: [exact step name from Codemagic]
Build URL:        [paste Codemagic build URL]
Build number:     [if visible]

Last 30 lines of failed step output:
-----
[paste here]
-----

Error lines from Xcode log (if "Build iOS" failed):
-----
[paste here]
-----

Apple values used:
- APP_STORE_APP_ID: [first 3 digits]***
- KEY_ID: [value]
- ISSUER_ID: [first 8 chars]***
- Bundle ID registered in portal: [yes/no]
- Internal Testers group exists: [yes/no]
```
