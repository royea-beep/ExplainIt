# Apple Review & Billing Risks — ExplainIt

## Current Billing Architecture

ExplainIt uses **LemonSqueezy** for payments:
- `POST /api/billing/checkout` creates a LemonSqueezy checkout URL
- User is redirected to LemonSqueezy's hosted checkout page (external browser/WebView)
- Webhook at `/api/billing/webhook` processes subscription events
- Plans: FREE, PRO ($29/mo), TEAM ($79/mo)
- Digital goods: AI-generated explainer videos, PDFs, demo pages

## Risk by Distribution Channel

### TestFlight Internal Testing — NO RISK
- Apple does **not** enforce App Store Review Guidelines for TestFlight internal builds
- No App Review process for internal testers (up to 100 people in your App Store Connect team)
- LemonSqueezy checkout works fine in WebView
- You can test the full billing flow without any changes
- **Action needed**: None

### TestFlight External Testing — LOW RISK
- External TestFlight requires a Beta App Review
- Beta App Review is lighter than full App Store Review
- Apple focuses on crashes, major bugs, and guideline violations
- LemonSqueezy in a beta is generally tolerated
- **Action needed**: None, but be aware a reviewer will see the app

### Public App Store — HIGH RISK
- **Guideline 3.1.1**: Apps offering digital content/subscriptions must use Apple's In-App Purchase (StoreKit)
- ExplainIt sells digital goods (generated videos, PDFs) = clearly covered by 3.1.1
- Using LemonSqueezy for in-app purchases will be **rejected**
- Apple takes 30% commission (15% for Small Business Program <$1M/year revenue)

**Specific violations if submitted as-is:**
1. `/api/billing/checkout` redirects to external payment = violates 3.1.1
2. Pricing page shows LemonSqueezy plans = violates 3.1.3 (no references to external purchase mechanisms)

## Options for Public App Store

### Option A — StoreKit for iOS, LemonSqueezy for web (Recommended)
- Implement StoreKit 2 / In-App Purchase for iOS app
- Keep LemonSqueezy for web users
- Use server-side receipt validation to unify entitlements
- Apple gets 30% of iOS purchases only
- **Complexity**: Medium (StoreKit integration, receipt validation, dual billing system)

### Option B — Reader app exemption
- Does NOT apply to ExplainIt — this exemption is for content consumption apps (Netflix, Kindle)
- ExplainIt generates content, which requires IAP

### Option C — External purchase link (US/EU only, post-2024 rulings)
- Apple now allows a single external purchase link in some jurisdictions
- Still requires a 27% commission to Apple (US) or compliance with DMA (EU)
- Complex legal/technical requirements
- **Not recommended** for initial launch

### Option D — Free app with no in-app billing
- Remove pricing/checkout from the iOS app entirely
- Users purchase subscriptions via web only
- iOS app checks subscription status server-side
- No Apple commission
- **Risk**: Apple may still reject if they detect the web paywall is required to use the app
- **Workaround**: Offer a genuinely useful free tier in the iOS app

## Recommended Path

1. **Now**: Ship to TestFlight with current LemonSqueezy billing. No changes needed.
2. **Before App Store submission**: Either implement StoreKit (Option A) or remove billing UI from iOS and gate behind web-only subscription (Option D).
3. **Simplest first version for App Store**: Free tier works fully in iOS app. Upgrade prompts link to web. This is a gray area but commonly accepted if the free tier is genuine.

## Summary Table

| Channel | LemonSqueezy OK? | Action Needed |
|---------|-------------------|---------------|
| TestFlight (internal) | Yes | None |
| TestFlight (external) | Yes | None |
| App Store (free tier) | Partial | Remove checkout UI from iOS, subscription via web |
| App Store (paid) | No | Implement StoreKit or use Option D |
