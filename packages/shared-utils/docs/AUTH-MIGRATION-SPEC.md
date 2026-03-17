# Auth migration spec — PostPilot & KeyDrop → @royea/shared-utils

## Goal
Both apps use the same auth stack from `@royea/shared-utils`: auth (JWT + bcrypt), auth-context (React), auth-guard (Next.js). Crypto stays local per app if it has different env/format (PostPilot uses ENCRYPTION_KEY + base64 for OAuth tokens; KeyDrop uses ENCRYPTION_MASTER_KEY + hex).

## shared-utils exports to use
- `@royea/shared-utils/auth` — hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, extractBearerToken
- `@royea/shared-utils/auth-context` — AuthProvider({ storageKey, refreshEndpoint }), useAuth()
- `@royea/shared-utils/auth-guard` — withAuth(handler)

## PostPilot migration

### 1. Add dependency
In `C:\Projects\PostPilot\package.json` add:
```json
"@royea/shared-utils": "file:../shared-utils"
```
Run `npm install` in PostPilot.

### 2. Layout
File: `src/app/layout.tsx`
- Change: `import { AuthProvider } from '@/lib/auth-context'` → `import { AuthProvider } from '@royea/shared-utils/auth-context'`
- Change: `<AuthProvider>{children}</AuthProvider>` → `<AuthProvider storageKey="postpilot_auth" refreshEndpoint="/api/auth/refresh">{children}</AuthProvider>`

### 3. API routes — auth
- `src/app/api/auth/login/route.ts` — import verifyPassword, signAccessToken, signRefreshToken from `@royea/shared-utils/auth`
- `src/app/api/auth/register/route.ts` — import hashPassword, signAccessToken, signRefreshToken from `@royea/shared-utils/auth`
- `src/app/api/auth/refresh/route.ts` — import verifyRefreshToken, signAccessToken, signRefreshToken from `@royea/shared-utils/auth`

### 4. API routes — withAuth
Replace `import { withAuth } from '@/lib/auth-guard'` with `import { withAuth } from '@royea/shared-utils/auth-guard'` in:
- src/app/api/brands/route.ts
- src/app/api/billing/route.ts
- src/app/api/billing/checkout/route.ts
- src/app/api/platforms/connected/route.ts
- src/app/api/brands/[id]/route.ts
- src/app/api/stats/route.ts
- src/app/api/brands/[id]/analyze/route.ts

### 5. API routes — connect (auth only)
- `src/app/api/platforms/[platform]/connect/route.ts` — import extractBearerToken, verifyAccessToken from `@royea/shared-utils/auth` (keep other imports).

### 6. Pages and components — useAuth
Replace `import { useAuth } from '@/lib/auth-context'` with `import { useAuth } from '@royea/shared-utils/auth-context'` in:
- src/app/dashboard/page.tsx, billing/page.tsx, platforms/page.tsx, register/page.tsx, login/page.tsx, page.tsx
- src/app/dashboard/[id]/page.tsx
- src/components/PlatformConnect.tsx

### 7. Do NOT change
- `src/app/api/platforms/[platform]/callback/route.ts` — keep `import { encrypt } from '@/lib/crypto'` (PostPilot crypto uses ENCRYPTION_KEY + different format).
- Any other file that only uses crypto.

### 8. Remove local auth files (after verifying build)
Delete: `src/lib/auth.ts`, `src/lib/auth-context.tsx`, `src/lib/auth-guard.ts`

---

## KeyDrop migration

### 1. Add dependency
In `C:\Projects\KeyDrop\package.json` add:
```json
"@royea/shared-utils": "file:../shared-utils"
```
Run `npm install` in KeyDrop.

### 2. Layout / provider
Find where AuthProvider is used (e.g. providers.tsx or layout). Use:
- `import { AuthProvider } from '@royea/shared-utils/auth-context'`
- `<AuthProvider storageKey="12clicks_auth" refreshEndpoint="/api/auth/refresh">`

### 3. API routes — auth
- auth/login, auth/register, auth/refresh: import from `@royea/shared-utils/auth`

### 4. API routes — withAuth
All routes that use withAuth: import from `@royea/shared-utils/auth-guard`

### 5. Pages — useAuth
All pages/components using useAuth: import from `@royea/shared-utils/auth-context`

### 6. Crypto
KeyDrop uses ENCRYPTION_MASTER_KEY + hex; shared-utils crypto uses same. Optional: migrate to `@royea/shared-utils/crypto` and configure keyEnvVar if different. If keeping local crypto, leave `src/lib/crypto.ts` as-is.

### 7. Remove local auth files
Delete: auth.ts, auth-context.tsx, auth-guard.ts (after build passes).

---

## Verification
- Run `npm run build` in each app after migration.
- Login → refresh → protected route must work; logout must clear storage.
