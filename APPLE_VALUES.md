# ExplainIt — Apple Values (Single Source of Truth)

## Fixed Values (already in repo)

| Field | Value |
|-------|-------|
| App Name | `ExplainIt` |
| Bundle ID | `com.explainit.app` |
| SKU | `explainit-ios` |
| Platform | iOS |
| Primary Language | English (U.S.) |
| iOS Deployment Target | 15.0 |
| Marketing Version | 1.0 |
| Production URL | `https://explainit-one.vercel.app` |
| Codemagic Workflow | `ios-testflight` |
| Xcode Scheme | `App` |
| Xcode Workspace | `ios/App/App.xcodeproj/project.xcworkspace` |
| Dependency Manager | Swift Package Manager (no CocoaPods) |

## Values You Get From Apple (fill after portal setup)

| Field | Where to get it | Value |
|-------|-----------------|-------|
| APP_STORE_APP_ID | App Store Connect → your app → General → Apple ID | `TO_BE_FILLED` |
| APP_STORE_KEY_ID | App Store Connect → Integrations → API → Key ID column | `TO_BE_FILLED` |
| APP_STORE_ISSUER_ID | App Store Connect → Integrations → API → Issuer ID (top of page) | `TO_BE_FILLED` |
| API Key File (.p8) | Downloaded once when creating key | `AuthKey_XXXXXXXXXX.p8` |
| Apple Team ID | developer.apple.com → Membership → Team ID | `TO_BE_FILLED` |

## Where Each Value Goes

| Value | Destination |
|-------|------------|
| APP_STORE_APP_ID | Codemagic → App → Environment Variables |
| APP_STORE_KEY_ID | Codemagic → Teams → Integrations → App Store Connect |
| APP_STORE_ISSUER_ID | Codemagic → Teams → Integrations → App Store Connect |
| API Key File (.p8) | Codemagic → Teams → Integrations → App Store Connect (file upload) |
| Apple Team ID | Not needed — Codemagic resolves it from the API key |
| Bundle ID | Already in repo. Registered in Apple Developer portal. |
| SKU | Only entered once when creating app in App Store Connect. |
