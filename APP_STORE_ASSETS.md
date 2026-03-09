# App Store Assets — ExplainIt

## Current State

| Asset | Status | Location |
|-------|--------|----------|
| App Icon (1024x1024) | Real PNG, Capacitor default gradient | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` |
| Splash Screen (2732x2732) | Real PNG at 1x/2x/3x, Capacitor default | `ios/App/App/Assets.xcassets/Splash.imageset/` |
| PWA icons | SVG placeholders | `public/icon-192.svg`, `public/icon-512.svg` |

## What's Acceptable for TestFlight Beta

Everything currently in the repo is **functional for TestFlight**:
- The 1024x1024 icon builds and displays correctly
- The splash screen shows during app launch
- No asset will cause a build failure

## What Needs Replacing Before App Store Launch

### App Icon
- **Current**: Capacitor's default blue/teal gradient. Generic.
- **Required**: Branded ExplainIt icon
- **Format**: 1024x1024 PNG, no transparency, no rounded corners (iOS adds them)
- **Replace at**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- **Tool**: Design in Figma/Canva, export as 1024x1024 PNG

### Splash Screen
- **Current**: Capacitor default (solid color with possible logo)
- **Required**: Branded splash matching app theme (#0a0a0f background)
- **Format**: 2732x2732 PNG (same image for 1x/2x/3x is fine)
- **Replace at**: All three files in `ios/App/App/Assets.xcassets/Splash.imageset/`
- **Keep**: `Contents.json` unchanged

### App Store Screenshots (for public launch only)
Not needed for TestFlight. Required for App Store submission:

| Device | Size | Count |
|--------|------|-------|
| iPhone 6.7" (15 Pro Max) | 1290 x 2796 | 3-10 |
| iPhone 6.5" (11 Pro Max) | 1242 x 2688 | 3-10 |
| iPad 12.9" (optional) | 2048 x 2732 | 3-10 |

### App Store Metadata (for public launch only)
- App description (4000 chars max)
- Keywords (100 chars max)
- Support URL
- Privacy Policy URL
- Category: Productivity or Business

## How to Replace Assets

### Replace app icon:
1. Create 1024x1024 PNG (no alpha channel)
2. Copy to `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
3. Commit and push — Codemagic builds with new icon

### Replace splash screen:
1. Create 2732x2732 PNG with #0a0a0f background
2. Copy to all three filenames in `ios/App/App/Assets.xcassets/Splash.imageset/`:
   - `splash-2732x2732.png`
   - `splash-2732x2732-1.png`
   - `splash-2732x2732-2.png`
3. Commit and push

### Replace PWA icons:
1. Create proper PNG icons (192x192 and 512x512)
2. Replace `public/icon-192.svg` → `public/icon-192.png`
3. Replace `public/icon-512.svg` → `public/icon-512.png`
4. Update `public/manifest.json` to reference `.png` files
5. Update `src/app/layout.tsx` apple-touch-icon href
