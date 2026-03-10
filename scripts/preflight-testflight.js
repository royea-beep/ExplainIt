#!/usr/bin/env node
/**
 * TestFlight Preflight Check
 * Run before triggering a Codemagic build to verify repo readiness.
 *
 * Usage: node scripts/preflight-testflight.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let pass = 0;
let fail = 0;
let warn = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}  →  ${detail}`);
    fail++;
  }
}

function warning(label, detail) {
  console.log(`  ⚠️  ${label}  →  ${detail}`);
  warn++;
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readJSON(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return null;
  }
}

function readFile(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return null;
  }
}

console.log("\n🔍 ExplainIt — TestFlight Preflight Check\n");

// ── Section 1: Required files ──
console.log("── Required Files ──");
check("codemagic.yaml exists", fileExists("codemagic.yaml"), "Create codemagic.yaml");
check("capacitor.config.json exists", fileExists("capacitor.config.json"), "Run: npx cap init");
check("package.json exists", fileExists("package.json"), "Missing package.json");
check("package-lock.json exists", fileExists("package-lock.json"), "Run: npm install");
check("ios/ directory exists", fileExists("ios/App/App.xcodeproj"), "Run: npx cap add ios");
check("SPM Package.swift exists", fileExists("ios/App/CapApp-SPM/Package.swift"), "Capacitor SPM not configured");
check("App icon exists", fileExists("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), "Add 1024x1024 app icon");
check("Prisma schema exists", fileExists("prisma/schema.prisma"), "Needed for postinstall (prisma generate)");

// ── Section 2: Bundle ID consistency ──
console.log("\n── Bundle ID Consistency ──");
const EXPECTED_BUNDLE = "com.explainit.app";

const capConfig = readJSON("capacitor.config.json");
check(
  "capacitor.config.json appId",
  capConfig && capConfig.appId === EXPECTED_BUNDLE,
  `Expected ${EXPECTED_BUNDLE}, got ${capConfig?.appId}`
);

const codemagicYaml = readFile("codemagic.yaml");
check(
  "codemagic.yaml bundle_identifier",
  codemagicYaml && codemagicYaml.includes(`bundle_identifier: ${EXPECTED_BUNDLE}`),
  `Expected ${EXPECTED_BUNDLE} in codemagic.yaml`
);

const pbxproj = readFile("ios/App/App.xcodeproj/project.pbxproj");
check(
  "Xcode project bundle ID",
  pbxproj && pbxproj.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${EXPECTED_BUNDLE}`),
  `Expected ${EXPECTED_BUNDLE} in project.pbxproj`
);

// ── Section 3: Capacitor config ──
console.log("\n── Capacitor Config ──");
const EXPECTED_URL = "https://explainit-one.vercel.app";
check(
  "Remote URL configured",
  capConfig && capConfig.server && capConfig.server.url === EXPECTED_URL,
  `Expected server.url = ${EXPECTED_URL}`
);
check(
  "webDir is 'out'",
  capConfig && capConfig.webDir === "out",
  "webDir must be 'out' (Codemagic creates it during build)"
);
check(
  "cleartext disabled (HTTPS only)",
  capConfig && capConfig.server && capConfig.server.cleartext === false,
  "Set server.cleartext = false for iOS"
);

// ── Section 4: Codemagic config ──
console.log("\n── Codemagic YAML ──");
check(
  "Uses mac_mini_m2 instance",
  codemagicYaml && codemagicYaml.includes("mac_mini_m2"),
  "Should use mac_mini_m2 for M2 builds"
);
check(
  "Has mkdir out step",
  codemagicYaml && codemagicYaml.includes("mkdir -p out"),
  "Need 'mkdir -p out' before cap sync"
);
check(
  "Has cap sync step",
  codemagicYaml && codemagicYaml.includes("cap sync ios"),
  "Need 'npx cap sync ios' step"
);
check(
  "Has code signing step",
  codemagicYaml && codemagicYaml.includes("xcode-project use-profiles"),
  "Need signing step"
);
check(
  "Has build step",
  codemagicYaml && codemagicYaml.includes("xcode-project build-ipa"),
  "Need build-ipa step"
);
check(
  "Has TestFlight publishing",
  codemagicYaml && codemagicYaml.includes("submit_to_testflight: true"),
  "Need TestFlight publishing"
);
check(
  "Triggers on master push",
  codemagicYaml && codemagicYaml.includes("pattern: master"),
  "Should trigger on master push"
);

// ── Section 5: SPM version match ──
console.log("\n── Version Consistency ──");
const spmPackage = readFile("ios/App/CapApp-SPM/Package.swift");
const capVersion = capConfig ? null : null;
const pkgJson = readJSON("package.json");
const capIosVersion = pkgJson?.dependencies?.["@capacitor/ios"];

if (spmPackage && capIosVersion) {
  const spmMatch = spmPackage.match(/exact:\s*"([^"]+)"/);
  const spmVersion = spmMatch ? spmMatch[1] : null;
  const pkgClean = capIosVersion.replace(/[\^~>=<]/, "");
  check(
    `SPM capacitor-swift-pm (${spmVersion}) ≈ @capacitor/ios (${capIosVersion})`,
    spmVersion && pkgClean.startsWith(spmVersion.split(".")[0] + "." + spmVersion.split(".")[1]),
    "Major.minor must match between SPM and npm"
  );
}

check(
  "Marketing version is 1.0",
  pbxproj && pbxproj.includes("MARKETING_VERSION = 1.0"),
  "Check MARKETING_VERSION in pbxproj"
);

// ── Section 6: Docs presence ──
console.log("\n── TestFlight Docs ──");
const docs = [
  "TESTFLIGHT.md",
  "APPLE_VALUES.md",
  "CODEMAGIC_SECRETS_MAP.md",
  "FIRST_TESTFLIGHT_BUILD_CHECKLIST.md",
  "TESTFLIGHT_FAILURE_MODES.md",
];
for (const doc of docs) {
  check(`${doc} exists`, fileExists(doc), `Missing ${doc}`);
}

// ── Section 7: Placeholders in config files ──
console.log("\n── Placeholder Scan (config files only) ──");
const configFiles = ["capacitor.config.json", "codemagic.yaml"];
for (const f of configFiles) {
  const content = readFile(f);
  if (content) {
    const hasTodo = /(?<!#.*)TO_BE_FILLED|(?<!#.*)PLACEHOLDER/i.test(content.split("\n").filter(l => !l.trim().startsWith("#")).join("\n"));
    check(
      `${f} has no active placeholders`,
      !hasTodo,
      "Contains TO_BE_FILLED or PLACEHOLDER outside comments"
    );
  }
}

// ── Summary ──
console.log("\n" + "═".repeat(50));
console.log(`  ✅ ${pass} passed    ❌ ${fail} failed    ⚠️  ${warn} warnings`);
console.log("═".repeat(50));

if (fail === 0) {
  console.log("\n🟢 REPO IS READY for Codemagic build.");
  console.log("   Remaining requirement: Apple portal values in Codemagic UI.");
  console.log("   Follow FIRST_TESTFLIGHT_BUILD_CHECKLIST.md to complete setup.\n");
} else {
  console.log("\n🔴 REPO HAS ISSUES — fix before triggering build.\n");
  process.exit(1);
}
