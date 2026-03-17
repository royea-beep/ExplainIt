# @royea/shared-utils

Shared utilities extracted from Roy's project portfolio. Battle-tested code from 19+ production projects.

## Modules

| Module | Import | Source Projects |
|--------|--------|-----------------|
| **Error Handler** | `@royea/shared-utils/errors` | ftable, Heroes-Hadera, VenueKit |
| **Content Filter** | `@royea/shared-utils/content-filter` | ftable, Wingman |
| **Rate Limiter** | `@royea/shared-utils/rate-limit` | ExplainIt, KeyDrop |
| **Analytics Tracker** | `@royea/shared-utils/analytics` | ftable (ftTracker.js) |
| **JWT Auth** | `@royea/shared-utils/auth` | PostPilot, KeyDrop |
| **AES-256-GCM Crypto** | `@royea/shared-utils/crypto` | KeyDrop, PostPilot |
| **i18n (HE/EN + RTL)** | `@royea/shared-utils/i18n` | ExplainIt, ZProjectManager |
| **URL Validation (SSRF)** | `@royea/shared-utils/validate-url` | ExplainIt |

## Quick Start

```bash
# From another project in C:\Projects:
npm install ../shared-utils
```

```typescript
// Error tracking
import { createErrorHandler } from '@royea/shared-utils/errors';
createErrorHandler({ supabaseUrl: '...', supabaseKey: '...' });

// Content moderation
import { filterContent } from '@royea/shared-utils/content-filter';
const result = filterContent("user input here");
if (!result.clean) console.log('Flagged:', result.flags);

// Rate limiting
import { checkRateLimit, getClientIp, LOGIN_LIMIT } from '@royea/shared-utils/rate-limit';
const ip = getClientIp(request);
const { allowed } = checkRateLimit(`login:${ip}`, LOGIN_LIMIT);

// Analytics
import { initTracker, track } from '@royea/shared-utils/analytics';
initTracker({ endpoint: '...', headers: { apikey: '...' } });
track('signup', { plan: 'pro' });

// Auth
import { hashPassword, signAccessToken } from '@royea/shared-utils/auth';
const hash = await hashPassword('password123');
const token = signAccessToken({ userId: '1', email: 'user@example.com' });

// Encryption
import { encrypt, decrypt } from '@royea/shared-utils/crypto';
const enc = encrypt('secret data');
const plain = decrypt(enc.ciphertext, enc.iv, enc.authTag);

// i18n (React)
import { LanguageProvider, useLanguage } from '@royea/shared-utils/i18n';

// URL validation
import { validateUrl } from '@royea/shared-utils/validate-url';
const check = validateUrl(userInput);
```
