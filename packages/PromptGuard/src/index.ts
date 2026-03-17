export interface SanitizeOptions {
  /** Mask PII (phone, email, URL) with placeholders. Default: true */
  maskPii?: boolean;
  /** Replace prompt-injection phrases with [filtered]. Default: true */
  blockInjection?: boolean;
  /** Max length after sanitization. Default: 2000 */
  maxLength?: number;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  maskPii: true,
  blockInjection: true,
  maxLength: 2000,
};

// PII patterns (regex only)
const PHONE_PATTERNS = [
  /\+\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{10,15}\b/g,
];
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

// Injection phrases (case-insensitive, whole-word where sensible)
const INJECTION_PHRASES = [
  /\bignore\s+previous\b/gi,
  /\bforget\s+your\s+instructions\b/gi,
  /\bsystem\s+prompt\b/gi,
  /\byou\s+are\s+now\b/gi,
  /\bact\s+as\b/gi,
  /\bdisregard\b/gi,
  /\bnew\s+instructions\b/gi,
  /\bjailbreak\b/gi,
];

function maskPii(text: string): string {
  let out = text;
  for (const re of PHONE_PATTERNS) {
    out = out.replace(re, '[PHONE]');
  }
  out = out.replace(EMAIL_PATTERN, '[EMAIL]');
  out = out.replace(URL_PATTERN, '[URL]');
  return out;
}

function blockInjection(text: string): string {
  let out = text;
  for (const re of INJECTION_PHRASES) {
    out = out.replace(re, '[filtered]');
  }
  return out;
}

/**
 * Sanitize user text before sending to LLMs: mask PII and block common prompt-injection phrases.
 */
export function sanitizeForLlm(text: string, options?: SanitizeOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = String(text);

  if (opts.maskPii) {
    result = maskPii(result);
  }
  if (opts.blockInjection) {
    result = blockInjection(result);
  }
  if (typeof opts.maxLength === 'number' && opts.maxLength > 0) {
    result = result.slice(0, opts.maxLength);
  }

  return result;
}
