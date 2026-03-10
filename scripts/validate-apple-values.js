#!/usr/bin/env node
/**
 * Pre-build validator for Apple/Codemagic external values.
 *
 * Run AFTER filling Apple portal values and BEFORE triggering Codemagic build.
 * Validates format/consistency of the 4 required external values.
 *
 * Usage:
 *   node scripts/validate-apple-values.js
 *   node scripts/validate-apple-values.js --values apple-values.local.json
 *
 * Without --values: interactive prompt guide (prints what to check manually).
 * With --values: validates a local JSON file with your Apple values.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let pass = 0;
let fail = 0;
let warn = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  pass++;
}
function bad(label, detail) {
  console.log(`  ❌ ${label}  →  ${detail}`);
  fail++;
}
function warning(label, detail) {
  console.log(`  ⚠️  ${label}  →  ${detail}`);
  warn++;
}

// Parse --values flag
const valuesArg = process.argv.find((a) => a.startsWith("--values"));
const valuesIdx = process.argv.indexOf("--values");
const valuesFile =
  valuesIdx !== -1 ? process.argv[valuesIdx + 1] : null;

console.log("\n🔐 ExplainIt — Apple/Codemagic Values Validator\n");

if (!valuesFile) {
  // No file provided — print interactive checklist
  console.log("No --values file provided. Running manual checklist mode.\n");
  console.log("── Values You Need ──");
  console.log("");
  console.log("  1. APP_STORE_APP_ID  (numeric, 10 digits, e.g. 6741234567)");
  console.log("     Source: App Store Connect → your app → General → Apple ID");
  console.log("     Paste:  Codemagic → App → Environment Variables → APP_STORE_APP_ID");
  console.log("");
  console.log("  2. KEY_ID  (10-char alphanumeric, e.g. ABC123DEF0)");
  console.log("     Source: App Store Connect → Integrations → API → Key ID column");
  console.log("     Paste:  Codemagic → Teams → Integrations → App Store Connect → Key ID");
  console.log("");
  console.log("  3. ISSUER_ID  (UUID, e.g. 686f97b8-3f8a-40b7-a6cd-5293a3168439)");
  console.log("     Source: App Store Connect → Integrations → API → top of page");
  console.log("     Paste:  Codemagic → Teams → Integrations → App Store Connect → Issuer ID");
  console.log("");
  console.log("  4. API KEY FILE  (.p8 file, downloaded once)");
  console.log("     Source: Downloaded when you created the API key (one-time download!)");
  console.log("     Paste:  Codemagic → Teams → Integrations → App Store Connect → file upload");
  console.log("");
  console.log("── Quick Validation (check these manually) ──");
  console.log("");
  console.log("  [ ] APP_STORE_APP_ID is purely numeric (no letters)");
  console.log("  [ ] KEY_ID is exactly 10 characters (letters + numbers)");
  console.log("  [ ] ISSUER_ID is UUID format (8-4-4-4-12 hex digits with dashes)");
  console.log("  [ ] .p8 file name starts with AuthKey_");
  console.log("  [ ] API key was created with ADMIN access (not Developer or Read Only)");
  console.log("  [ ] Bundle ID com.explainit.app is registered in Apple Developer portal");
  console.log("  [ ] App exists in App Store Connect with that bundle ID");
  console.log("  [ ] TestFlight group 'Internal Testers' exists in App Store Connect");
  console.log("");
  console.log("── Save Values Locally (optional) ──");
  console.log("");
  console.log("  Copy apple-values.template.json → apple-values.local.json");
  console.log("  Fill in your values, then run:");
  console.log("  node scripts/validate-apple-values.js --values apple-values.local.json");
  console.log("");
  process.exit(0);
}

// File provided — validate it
const filePath = path.resolve(valuesFile);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

let values;
try {
  values = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (e) {
  console.error(`Invalid JSON: ${e.message}`);
  process.exit(1);
}

console.log(`Validating: ${filePath}\n`);

// ── APP_STORE_APP_ID ──
console.log("── APP_STORE_APP_ID ──");
const appId = values.APP_STORE_APP_ID || values.appStoreAppId || "";
if (!appId) {
  bad("APP_STORE_APP_ID present", "Missing — get from App Store Connect → app → General → Apple ID");
} else if (!/^\d{7,15}$/.test(appId)) {
  bad("APP_STORE_APP_ID format", `Got "${appId}" — must be 7-15 digits, no letters. Common mistake: pasting Key ID instead.`);
} else {
  ok(`APP_STORE_APP_ID = ${appId} (numeric, ${appId.length} digits)`);
}

// ── KEY_ID ──
console.log("\n── KEY_ID ──");
const keyId = values.KEY_ID || values.keyId || "";
if (!keyId) {
  bad("KEY_ID present", "Missing — get from App Store Connect → Integrations → API");
} else if (!/^[A-Z0-9]{10}$/.test(keyId)) {
  bad("KEY_ID format", `Got "${keyId}" — must be exactly 10 uppercase alphanumeric chars`);
} else {
  ok(`KEY_ID = ${keyId} (10 chars)`);
}

// ── ISSUER_ID ──
console.log("\n── ISSUER_ID ──");
const issuerId = values.ISSUER_ID || values.issuerId || "";
if (!issuerId) {
  bad("ISSUER_ID present", "Missing — get from App Store Connect → Integrations → API → top of page");
} else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issuerId)) {
  bad("ISSUER_ID format", `Got "${issuerId}" — must be UUID format (8-4-4-4-12 hex with dashes)`);
} else {
  ok(`ISSUER_ID = ${issuerId} (valid UUID)`);
}

// ── P8 file reference ──
console.log("\n── API Key File ──");
const p8 = values.p8File || values.apiKeyFile || "";
if (!p8) {
  warning("p8File reference", "Not specified — make sure you upload the .p8 to Codemagic manually");
} else if (!p8.endsWith(".p8")) {
  bad("p8File extension", `Got "${p8}" — must be a .p8 file`);
} else if (!p8.startsWith("AuthKey_")) {
  warning("p8File name convention", `Got "${p8}" — Apple .p8 files are normally named AuthKey_<KeyID>.p8`);
} else {
  ok(`p8File = ${p8}`);
  // Cross-check: p8 filename should contain key ID
  if (keyId && !p8.includes(keyId)) {
    warning("p8 ↔ KEY_ID cross-check", `File "${p8}" doesn't contain KEY_ID "${keyId}" — verify it's the right key file`);
  }
}

// ── Cross-validation with repo ──
console.log("\n── Repo Cross-Check ──");

// Verify bundle ID is what Codemagic expects
const codemagicYaml = (() => {
  try { return fs.readFileSync(path.join(ROOT, "codemagic.yaml"), "utf8"); } catch { return null; }
})();
if (codemagicYaml) {
  const bundleMatch = codemagicYaml.match(/bundle_identifier:\s*(.+)/);
  if (bundleMatch) {
    ok(`codemagic.yaml bundle_identifier = ${bundleMatch[1].trim()}`);
  }
}

// Check codemagic.yaml references APP_STORE_APP_ID
if (codemagicYaml && codemagicYaml.includes("APP_STORE_APP_ID")) {
  ok("codemagic.yaml uses $APP_STORE_APP_ID for build number increment");
} else {
  warning("APP_STORE_APP_ID usage", "codemagic.yaml doesn't reference APP_STORE_APP_ID");
}

// Check beta group
if (codemagicYaml && codemagicYaml.includes("Internal Testers")) {
  warning("Beta group 'Internal Testers'", "Must exist in App Store Connect → TestFlight BEFORE first build (or publishing step will warn)");
}

// ── Summary ──
console.log("\n" + "═".repeat(50));
console.log(`  ✅ ${pass} passed    ❌ ${fail} failed    ⚠️  ${warn} warnings`);
console.log("═".repeat(50));

if (fail === 0 && warn === 0) {
  console.log("\n🟢 Values look correct. Ready to enter in Codemagic.\n");
} else if (fail === 0) {
  console.log("\n🟡 Values look correct but check the warnings above.\n");
} else {
  console.log("\n🔴 Fix the errors above before entering values in Codemagic.\n");
  process.exit(1);
}
