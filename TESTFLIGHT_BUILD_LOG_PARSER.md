# TestFlight Build Log Parser

How to read Codemagic build logs when the first build fails or succeeds.

## If Build Fails Before Signing

**Step name**: "Install dependencies" or "Sync Capacitor iOS"

### What to look for
- `npm ERR!` lines — dependency resolution failed
- `webDir not found` — out/ directory wasn't created
- `ERESOLVE` — npm peer dependency conflict
- `prisma generate` errors in postinstall

### Likely causes
| Log pattern | Cause | Fix |
|-------------|-------|-----|
| `npm ERR! code ERESOLVE` | package-lock.json out of sync | Run `npm install` locally, commit updated lock file |
| `Cannot find module` | Missing dependency | Run `npm ci` locally to reproduce |
| `webDir "out" not found` | mkdir step missing or failed | Check codemagic.yaml step ordering |
| `prisma generate` error | Schema issue | Run `npx prisma generate` locally |

### Next action
Fix locally, commit, push. Codemagic will auto-trigger new build.

---

## If Build Fails During Signing

**Step name**: "Set up code signing"

### What to look for
- `No provisioning profiles found`
- `No signing certificate`
- `Could not find any available provisioning profiles`
- `Authentication failed` or `401`

### Likely causes
| Log pattern | Cause | Fix |
|-------------|-------|-----|
| `No provisioning profiles found` | API key not uploaded to Codemagic, or bundle ID not registered | Upload .p8 in Teams → Integrations; register com.explainit.app in Apple Developer portal |
| `Authentication failed` | Wrong Issuer ID or Key ID | Re-check values in Codemagic integration settings |
| `No signing certificate` | API key doesn't have Admin access | Regenerate key with Admin role in App Store Connect |
| `Bundle identifier mismatch` | Bundle ID in Codemagic ≠ registered ID | Must be exactly `com.explainit.app` everywhere |

### Next action
Fix in Codemagic UI or Apple portal. Re-trigger build (no code change needed — use manual trigger).

---

## If Build Fails During Compile/Archive

**Step name**: "Build iOS"

### What to look for
- `xcodebuild` error lines (search for `error:` in log)
- `Swift Compiler Error`
- `SPM resolution failed`
- `missing package product`

### Likely causes
| Log pattern | Cause | Fix |
|-------------|-------|-----|
| `missing package product 'Capacitor'` | SPM can't resolve capacitor-swift-pm | Check ios/App/CapApp-SPM/Package.swift version matches @capacitor/ios in package.json |
| `Swift Compiler Error` | Xcode/Swift version issue | Check Codemagic Xcode version (latest stable is default) |
| `Multiple commands produce` | Duplicate resources after cap sync | Delete ios/App/Pods if it exists (shouldn't with SPM) |

### Where to find detailed Xcode logs
Codemagic saves full Xcode build logs as artifacts:
- Download from Artifacts section → `/tmp/xcodebuild_logs/*.log`
- Search for `error:` to find the actual failure

### Next action
Fix the dependency/config issue, commit, push.

---

## If Build Fails During Upload

**Step name**: Publishing (after "Build iOS" succeeds)

### What to look for
- `ERROR ITMS-` error codes
- `A build with this version and build number already exists`
- `No suitable application records were found`
- `Authentication failed`

### Likely causes
| Log pattern | Cause | Fix |
|-------------|-------|-----|
| `already exists` | Build number wasn't incremented | Set APP_STORE_APP_ID in Codemagic env vars |
| `No suitable application records` | App doesn't exist in App Store Connect | Create app with bundle ID com.explainit.app |
| `Authentication failed` | API key issue | Re-upload .p8 in Codemagic integrations |
| `ERROR ITMS-90189` | App icon missing or wrong format | Ensure 1024x1024 PNG exists in AppIcon.appiconset |

### Next action
Fix in Apple portal or Codemagic UI. Re-trigger build manually.

---

## If Build Succeeds But No TestFlight Build Appears

### What to check in App Store Connect
1. Go to your app → TestFlight → iOS Builds
2. Look for the build — it should show as "Processing"
3. If not visible at all: wrong app/bundle ID mismatch between Codemagic and App Store Connect

### Likely delays
| Scenario | Wait time |
|----------|-----------|
| First ever build for this app | 15-45 minutes |
| Subsequent builds | 10-20 minutes |
| Apple systems busy (WWDC, launch events) | Up to 2 hours |

### Check for compliance emails
- Apple sometimes sends emails about Export Compliance (encryption)
- Check royearguan@gmail.com for any Apple emails
- If asked about encryption: ExplainIt uses HTTPS only (standard exemption) — answer "Yes, uses exempt encryption"

### Next action
Wait. If nothing after 1 hour, check App Store Connect → Activity for any processing errors.

---

## Minimum Log Snippet to Bring Back

When asking for help debugging a failed build, copy these sections:

### 1. The failing step output (last 30 lines)
In Codemagic, click the failed step → copy the last 30 lines of output.

### 2. The step name
Exact name as shown in Codemagic (e.g., "Set up code signing", "Build iOS").

### 3. For compile errors specifically
Download the Xcode log artifact and search for lines containing `error:`. Copy all unique error lines.

### Template for reporting
```
Step that failed: [step name]
Build URL: [paste Codemagic build URL]

Last 30 lines of output:
[paste here]

Error lines from Xcode log (if compile failure):
[paste here]
```
