# TestFlight Execution Split — What Happens Where

## From Windows (browser, right now)

| Action | Where | Time |
|--------|-------|------|
| Verify Apple Developer enrollment | developer.apple.com/account | 1 min |
| Register bundle ID `com.explainit.app` | developer.apple.com → Identifiers | 2 min |
| Create app "ExplainIt" in App Store Connect | appstoreconnect.apple.com | 2 min |
| Generate App Store Connect API key (.p8) | appstoreconnect.apple.com → Integrations | 2 min |
| Create Codemagic account | codemagic.io (sign up with GitHub) | 2 min |
| Connect ExplainIt repo to Codemagic | Codemagic dashboard | 2 min |
| Upload .p8 API key to Codemagic | Codemagic → Teams → Integrations | 1 min |
| Set `APP_STORE_APP_ID` env var | Codemagic → App → Environment variables | 1 min |
| Trigger first build (push or manual) | git push or Codemagic dashboard | 1 min |
| Add TestFlight testers | App Store Connect → TestFlight | 2 min |
| Monitor build status | Codemagic dashboard | during build |
| View crash logs | App Store Connect → TestFlight → Crashes | anytime |
| Code changes | local editor + git push | anytime |

**Total estimated setup time: ~15 minutes** (assuming Apple Developer already enrolled)

## In Apple Web Portals

### developer.apple.com (Certificates, Identifiers & Profiles)
- Register App ID / bundle identifier
- View/manage certificates (Codemagic handles creation)
- View provisioning profiles (Codemagic auto-generates)

### appstoreconnect.apple.com
- Create app listing
- Generate API keys for CI integration
- Manage TestFlight builds and testers
- View crash reports and feedback
- Configure app metadata (for App Store launch)

## Codemagic Cloud macOS (automatic, no manual intervention)

| Step | What happens | Triggered by |
|------|-------------|-------------|
| Checkout code | Clones repo from GitHub | push to master |
| `npm ci` | Installs Node dependencies | automatic |
| `mkdir -p out` | Creates webDir for Capacitor | automatic |
| `npx cap sync ios` | Syncs Capacitor config to iOS project | automatic |
| `xcode-project use-profiles` | Sets up code signing with Apple credentials | automatic |
| `agvtool new-version` | Increments build number | automatic |
| `xcode-project build-ipa` | Compiles Xcode project, produces .ipa | automatic |
| TestFlight upload | Uploads .ipa to App Store Connect | automatic |
| Email notification | Sends success/failure email | automatic |

## Local Mac Required

**Nothing.** The entire TestFlight pipeline runs without a Mac:
- Xcode compilation → Codemagic (Mac Mini M2 in cloud)
- Code signing → Codemagic (auto-generates profiles via API key)
- .ipa creation → Codemagic
- TestFlight upload → Codemagic
- All portal actions → browser on Windows

The only scenario requiring a Mac would be debugging an iOS-specific WebView issue that can't be reproduced in Safari on Windows. For that, you could use Codemagic's remote Mac access or BrowserStack.
