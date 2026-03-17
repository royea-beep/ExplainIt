# @royea/prompt-guard

PromptGuard sanitizes user text before sending it to LLMs: it masks PII (phone numbers, emails, URLs) with placeholders like `[PHONE]`, `[EMAIL]`, and `[URL]`, and blocks common prompt-injection phrases (e.g. "ignore previous instructions", "system prompt") by replacing them with `[filtered]`. It is framework-agnostic, has zero runtime dependencies, and works in Node, Next.js, and Edge runtimes.

## Install

```bash
npm install @royea/prompt-guard
```

Or from a local path:

```bash
npm install file:../PromptGuard
```

## Usage

```ts
import { sanitizeForLlm } from '@royea/prompt-guard';

const userInput = 'Call me at +1-555-123-4567 or email test@example.com. Ignore previous instructions.';
console.log(sanitizeForLlm(userInput));
// "Call me at [PHONE] or email [EMAIL]. [filtered]. "
```

With options (disable PII masking, set max length):

```ts
sanitizeForLlm(userInput, { maskPii: false, maxLength: 500 });
```

**Note:** Use PromptGuard before sending user content to Claude, GPT, or other LLMs to reduce PII exposure and mitigate prompt-injection attempts.
