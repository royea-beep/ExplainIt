/**
 * Content Filter — client/server-side user-generated content moderation.
 * Extracted from ftable + Wingman.
 *
 * Detects: profanity (Hebrew + English), phone numbers, emails, URLs, spam patterns.
 * Zero dependencies. Works in browser and Node.js.
 *
 * Usage:
 *   import { filterContent } from '@royea/shared-utils/content-filter';
 *   const result = filterContent("some user text");
 *   // result.clean   — boolean
 *   // result.flags   — string[] e.g. ["profanity", "phone_number"]
 */

export type ContentFlag = 'profanity' | 'phone_number' | 'email' | 'url' | 'spam_caps' | 'spam_repeated';

export interface FilterResult {
  clean: boolean;
  flags: ContentFlag[];
}

const ENGLISH_TERMS = [
  'fuck', 'fucking', 'fucked', 'fucker',
  'shit', 'shitty', 'bullshit',
  'asshole', 'bastard', 'bitch',
  'dick', 'cock', 'cunt',
  'nigger', 'nigga', 'faggot', 'fag',
  'retard', 'retarded',
  'whore', 'slut',
  'kike', 'chink', 'spic', 'wetback',
  'kill yourself', 'kys',
  'rape', 'raping',
  'pedo', 'pedophile',
  'nazi',
];

const HEBREW_TERMS = [
  '\u05D6\u05D5\u05E0\u05D4',               // zona
  '\u05DE\u05E0\u05D9\u05D0\u05DA',         // maniak
  '\u05D7\u05D0\u05E8\u05D4',               // chara
  '\u05D6\u05D9\u05D9\u05DF',               // zayin
  '\u05DB\u05D5\u05E1\u05D0\u05DE\u05DA',   // kusemek
  '\u05D9\u05D0\u05DC\u05D4 \u05D9\u05DE\u05D5\u05EA', // yalla yamut
  '\u05DE\u05E1\u05E8\u05D9\u05D7',         // masriah
  '\u05D1\u05DF \u05D6\u05D5\u05E0\u05D4', // ben zona
  '\u05D0\u05D7\u05D5\u05E9\u05DA',         // ahushakh
  '\u05D7\u05D9\u05D9\u05D4',               // chaya
  '\u05DE\u05E4\u05D2\u05E8',               // mefager
  '\u05EA\u05DE\u05D5\u05EA',               // tamut
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const allTerms = [...ENGLISH_TERMS, ...HEBREW_TERMS];

const profanityPattern = new RegExp(
  allTerms.map((term) => {
    const escaped = escapeRegex(term);
    const isAscii = /^[\x20-\x7E]+$/.test(term);
    return isAscii ? '\\b' + escaped + '\\b' : escaped;
  }).join('|'),
  'gi'
);

// Israeli + international phone patterns
const phonePattern = /(?:\+9[0-9]{2}[\s-]?[0-9]{1,2}[\s-]?[0-9]{3}[\s-]?[0-9]{4})|(?:\b0[5-9][0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b)|(?:\+[1-9][0-9]{0,2}[\s-]?(?:\([0-9]{1,4}\)[\s-]?)?[0-9]{4,14})/g;

const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const urlPattern = /(?:https?:\/\/|www\.)[^\s<>")\]]+|(?:[a-zA-Z0-9\-]+\.(?:com|net|org|io|co|me|app|dev|xyz|info|il|co\.il)(?:\/[^\s<>")\]]*)?)/gi;

const allCapsPattern = /^[^a-z\u05D0-\u05EA]{50,}$/;

const repeatedCharPattern = /(.)\1{4,}/;

export function filterContent(text: string): FilterResult {
  if (!text || typeof text !== 'string') {
    return { clean: true, flags: [] };
  }

  const flags: ContentFlag[] = [];

  profanityPattern.lastIndex = 0;
  if (profanityPattern.test(text)) flags.push('profanity');

  phonePattern.lastIndex = 0;
  if (phonePattern.test(text)) flags.push('phone_number');

  emailPattern.lastIndex = 0;
  if (emailPattern.test(text)) flags.push('email');

  urlPattern.lastIndex = 0;
  if (urlPattern.test(text)) flags.push('url');

  if (text.length >= 50 && allCapsPattern.test(text)) flags.push('spam_caps');

  if (repeatedCharPattern.test(text)) flags.push('spam_repeated');

  return { clean: flags.length === 0, flags };
}

/** Check only profanity (lighter check for chat messages) */
export function hasProfanity(text: string): boolean {
  if (!text) return false;
  profanityPattern.lastIndex = 0;
  return profanityPattern.test(text);
}

/** Check for contact info (phone, email, URL) */
export function hasContactInfo(text: string): boolean {
  if (!text) return false;
  phonePattern.lastIndex = 0;
  emailPattern.lastIndex = 0;
  urlPattern.lastIndex = 0;
  return phonePattern.test(text) || emailPattern.test(text) || urlPattern.test(text);
}
