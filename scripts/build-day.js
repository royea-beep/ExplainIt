#!/usr/bin/env node
/**
 * Build Day — Single pre-build command.
 *
 * Runs repo preflight + apple values validation in one shot.
 * Execute this ONCE before triggering your first Codemagic build.
 *
 * Usage:
 *   node scripts/build-day.js                                   # repo check only
 *   node scripts/build-day.js --values apple-values.local.json  # repo + values check
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const valuesIdx = process.argv.indexOf("--values");
const valuesFile = valuesIdx !== -1 ? process.argv[valuesIdx + 1] : null;

console.log("╔══════════════════════════════════════════════════╗");
console.log("║         ExplainIt — Build Day Checklist          ║");
console.log("╚══════════════════════════════════════════════════╝\n");

// Phase 1: Repo preflight
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  PHASE 1: Repo Readiness");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

let repoOk = true;
try {
  execSync(`node "${path.join(ROOT, "scripts", "preflight-testflight.js")}"`, {
    stdio: "inherit",
    cwd: ROOT,
  });
} catch {
  repoOk = false;
}

// Phase 2: Apple values (if provided)
let valuesOk = null; // null = not checked
if (valuesFile) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PHASE 2: Apple Values Validation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  valuesOk = true;
  try {
    execSync(
      `node "${path.join(ROOT, "scripts", "validate-apple-values.js")}" --values "${valuesFile}"`,
      { stdio: "inherit", cwd: ROOT }
    );
  } catch {
    valuesOk = false;
  }
} else {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PHASE 2: Apple Values — SKIPPED (no --values file)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n  To validate Apple values:");
  console.log("  cp apple-values.template.json apple-values.local.json");
  console.log("  # fill in your 4 values");
  console.log("  node scripts/build-day.js --values apple-values.local.json\n");
}

// Phase 3: Summary + next action
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  VERDICT");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

if (repoOk && valuesOk === true) {
  console.log("  🟢 ALL CLEAR — Ready to trigger Codemagic build.\n");
  console.log("  Next steps:");
  console.log("  1. Enter values in Codemagic UI (see TESTFLIGHT_QUICKSTART.md Step 7)");
  console.log("  2. Trigger build:");
  console.log('     git commit --allow-empty -m "chore: trigger first TestFlight build"');
  console.log("     git push origin master\n");
} else if (repoOk && valuesOk === null) {
  console.log("  🟡 Repo is ready. Apple values not yet validated.\n");
  console.log("  Next steps:");
  console.log("  1. Complete Apple portal setup (TESTFLIGHT_QUICKSTART.md Steps 1-5)");
  console.log("  2. Save values to apple-values.local.json");
  console.log("  3. Re-run: node scripts/build-day.js --values apple-values.local.json\n");
} else if (repoOk && valuesOk === false) {
  console.log("  🔴 Repo is ready but Apple values have errors. Fix values first.\n");
  process.exit(1);
} else {
  console.log("  🔴 Repo has issues. Fix repo first, then validate Apple values.\n");
  process.exit(1);
}
