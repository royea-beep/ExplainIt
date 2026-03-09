# ExplainIt — TestFlight Deployment Guide

## Current State

- Capacitor iOS project exists (`ios/` directory with `App.xcodeproj`)
- Remote URL mode: WebView loads `https://explainit-one.vercel.app`
- Bundle ID: `com.explainit.app`
- Capacitor 8.2.0, iOS 15+ target
- App icon (1024x1024) and splash screen configured
- `codemagic.yaml` configured for automatic builds on push to `master`
- No local Mac required — all iOS builds run in Codemagic cloud CI

## Prerequisites (All Doable From Windows)

1. **Apple Developer Program** — Enroll at [developer.apple.com](https://developer.apple.com/programs/) ($99/year). Required for code signing and TestFlight distribution.
2. **App ID** — Create in Apple Developer portal > Certificates, Identifiers & Profiles > Identifiers. Set bundle ID to `com.explainit.app`.
3. **App Store Connect API Key** — Used by Codemagic for automatic signing and TestFlight upload. Created in App Store Connect > Integrations.
4. **Codemagic Account** — Sign up at [codemagic.io](https://codemagic.io). Free tier includes 500 build minutes/month (enough for ~16 builds).

## Setup Steps

### 1. Apple Developer Enrollment

- Go to [developer.apple.com/programs](https://developer.apple.com/programs/)
- Enroll as Individual ($99/year)
- Enrollment takes up to 48 hours to process

### 2. Create App in App Store Connect

- Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- Click "My Apps" > "+" > "New App"
- Platform: iOS
- Name: ExplainIt
- Bundle ID: `com.explainit.app` (register it first in Developer portal if not listed)
- SKU: `com.explainit.app`
- Primary language: English

### 3. Generate App Store Connect API Key

- In App Store Connect, go to Users and Access > Integrations > App Store Connect API
- Click "+" to generate a new key
- Name: `Codemagic`
- Access: **Admin** (required for TestFlight upload and signing)
- Download the `.p8` file — you can only download it once
- Note the **Issuer ID** and **Key ID** displayed on the page

### 4. Set Up Codemagic

- Go to [codemagic.io](https://codemagic.io) and sign in with GitHub
- Add the ExplainIt repository
- Select "Capacitor" as the project type
- Codemagic will detect `codemagic.yaml` automatically

### 5. Upload API Key to Codemagic

- In Codemagic, go to Teams > your team > Integrations
- Under "App Store Connect", click "Connect"
- Enter the **Issuer ID**, **Key ID**, and upload the `.p8` file
- This enables automatic code signing and TestFlight upload

### 6. Trigger a Build

- Push any commit to `master`
- Codemagic automatically picks up the push and starts the workflow
- Build takes ~10-15 minutes
- On success, the `.ipa` uploads to TestFlight automatically
- TestFlight processing takes another 10-30 minutes on Apple's side
- Testers in the "Internal Testers" group get notified

## What Can Be Done From Windows

- All Apple Developer portal actions (web-based)
- App Store Connect setup and management (web-based)
- Codemagic configuration and monitoring (web-based)
- Code changes, `capacitor.config.json` updates, and `git push`
- Adding/removing TestFlight testers
- Viewing crash logs and feedback in App Store Connect

## What Requires macOS (Codemagic Handles This)

- `xcodebuild` compilation
- Code signing with provisioning profiles
- `.ipa` generation
- TestFlight upload via App Store Connect API
- Cocoapods / SPM dependency resolution

## Known Issues

- **App icon sizes** — Only 1024x1024 exists. Xcode usually auto-generates required sizes from the single asset, but if the build fails on icon validation, generate an icon set using an online tool (e.g., appicon.co) and place files in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
- **webDir set to "out"** — Irrelevant in remote URL mode since `server.url` overrides it. Capacitor still requires the directory to exist; `npx cap sync` handles this.
- **No push notifications** — Not configured yet. Would require APNs setup in Apple Developer portal and a Capacitor push plugin.
- **LemonSqueezy billing in WebView** — See Apple Billing Risk section below.

## Apple Billing Risk

- **TestFlight beta**: LemonSqueezy web checkout works fine. Apple does not enforce IAP rules during beta testing — there is no App Store Review for TestFlight builds distributed to internal testers.
- **Public App Store release**: Apple requires StoreKit / In-App Purchase for digital goods and services sold within the app. Using an external payment processor (LemonSqueezy) for digital content violates App Store Review Guideline 3.1.1. Apple takes a 30% commission (15% for Small Business Program).
- **Recommendation**: Use TestFlight for user validation and feedback first. Before submitting to the public App Store, either integrate StoreKit for iOS purchases or explore the recent court rulings on external payment links (varies by jurisdiction).

## Troubleshooting

### Build fails in Codemagic
- Check the build logs in Codemagic dashboard — the exact failure step and error are shown
- Most common cause: API key permissions. Ensure the key has **Admin** role
- If `npm ci` fails: check that `package-lock.json` is committed and up to date
- If `cap sync` fails: ensure `@capacitor/ios` is in `package.json` dependencies

### App shows blank/white screen
- Verify `https://explainit-one.vercel.app` is deployed and accessible
- Check the Vercel deployment status
- In `capacitor.config.json`, confirm `server.url` is set correctly
- iOS App Transport Security requires HTTPS — the current config uses HTTPS so this should not be an issue

### Code signing fails
- Regenerate the API key in App Store Connect with Admin role
- Re-upload the `.p8` file to Codemagic
- Ensure the bundle ID `com.explainit.app` is registered in the Apple Developer portal
- Codemagic's automatic signing creates provisioning profiles on the fly — no manual profile management needed

### TestFlight build not appearing
- Apple processing can take 10-30 minutes after upload
- Check App Store Connect > TestFlight for processing status
- If stuck in "Processing", wait — Apple's pipeline occasionally has delays
- Ensure at least one internal tester is added to the "Internal Testers" group
