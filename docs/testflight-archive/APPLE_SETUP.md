# Apple Developer & App Store Connect Setup

Everything below can be done from a browser on Windows. No Mac needed.

## Step 1 — Enroll in Apple Developer Program

1. Go to https://developer.apple.com/programs/
2. Click "Enroll"
3. Sign in with your Apple ID (or create one)
4. Enroll as **Individual** ($99/year)
5. Complete payment
6. Wait for approval (usually instant, can take up to 48h)

## Step 2 — Register the Bundle ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click "+" to register a new identifier
3. Select **App IDs** → Continue
4. Select **App** → Continue
5. Fill in:
   - **Description**: `ExplainIt`
   - **Bundle ID**: Select "Explicit" and enter: `com.explainit.app`
6. Under Capabilities, no special ones needed for now
7. Click Continue → Register

## Step 3 — Create the App in App Store Connect

1. Go to https://appstoreconnect.apple.com/apps
2. Click "+" → "New App"
3. Fill in:
   - **Platforms**: iOS
   - **Name**: `ExplainIt`
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.explainit.app` from dropdown
   - **SKU**: `explainit-ios`
   - **User Access**: Full Access
4. Click Create
5. **Note the Apple ID** shown on the app page (a numeric ID like `1234567890`). You'll need this as `APP_STORE_APP_ID` in Codemagic.

## Step 4 — Generate App Store Connect API Key

1. Go to https://appstoreconnect.apple.com/access/integrations/api
2. Click "+" to generate a new key
3. Fill in:
   - **Name**: `Codemagic`
   - **Access**: `Admin`
4. Click Generate
5. **Download the `.p8` file immediately** — you can only download it once
6. Note these three values (visible on the page):
   - **Issuer ID**: (shown at top, looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - **Key ID**: (shown next to the key name, looks like `XXXXXXXXXX`)
   - **Downloaded file**: `AuthKey_XXXXXXXXXX.p8`

## What You'll Need for Codemagic

After completing the steps above, you'll have these values to enter in Codemagic:

| Value | Where to find it | Example |
|-------|-------------------|---------|
| Issuer ID | App Store Connect → Integrations → API | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| Key ID | App Store Connect → Integrations → API | `ABC1234DEF` |
| API Key file | Downloaded `.p8` file | `AuthKey_ABC1234DEF.p8` |
| App Apple ID | App Store Connect → App → General → Apple ID | `1234567890` |
| Bundle ID | Already configured | `com.explainit.app` |

## Naming Reference

These names are used consistently across all config:

| Field | Value |
|-------|-------|
| App Name | `ExplainIt` |
| Bundle ID | `com.explainit.app` |
| SKU | `explainit-ios` |
| Version | `1.0` |
| Build | Auto-incremented by Codemagic |
| Deployment Target | iOS 15.0 |
| Production URL | `https://explainit-one.vercel.app` |
