#!/usr/bin/env node
// scripts/verify-auth-setup.mjs
// Verify that Google OAuth authentication is properly configured

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });

const checks = {
  passed: [],
  failed: [],
  warnings: [],
};

console.log("🔍 Verifying Google OAuth Authentication Setup\n");

// Check 1: Environment Variables
console.log("1️⃣  Checking environment variables...");
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
];

const optionalEnvVars = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];

requiredEnvVars.forEach((envVar) => {
  if (process.env[envVar]) {
    checks.passed.push(`✅ ${envVar} is set`);
  } else {
    checks.failed.push(`❌ ${envVar} is missing`);
  }
});

optionalEnvVars.forEach((envVar) => {
  if (process.env[envVar]) {
    checks.passed.push(`✅ ${envVar} is set`);
  } else {
    checks.warnings.push(`⚠️  ${envVar} is not set (optional but recommended)`);
  }
});

// Check 2: Supabase URL format
console.log("\n2️⃣  Validating Supabase URL format...");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  if (supabaseUrl.startsWith("https://") && supabaseUrl.includes(".supabase.co")) {
    checks.passed.push("✅ Supabase URL format is valid");
  } else {
    checks.failed.push("❌ Supabase URL format is invalid (should be https://xxx.supabase.co)");
  }
} else {
  checks.failed.push("❌ Cannot validate Supabase URL - not set");
}

// Check 3: Database connection format
console.log("\n3️⃣  Validating database connection...");
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  if (databaseUrl.startsWith("postgresql://")) {
    checks.passed.push("✅ Database URL format is valid");
  } else {
    checks.failed.push("❌ Database URL format is invalid (should start with postgresql://)");
  }
} else {
  checks.failed.push("❌ Cannot validate Database URL - not set");
}

// Check 4: File existence
console.log("\n4️⃣  Checking required files...");
const requiredFiles = [
  "../middleware.ts",
  "../src/lib/supabase/server.ts",
  "../src/lib/supabase/client.ts",
  "../src/lib/supabase/middleware.ts",
  "../src/app/auth/login/page.tsx",
  "../src/app/auth/callback/route.ts",
  "../src/components/auth/GoogleSignInButton.tsx",
  "../src/components/navigation/UserMenu.tsx",
];

import { existsSync } from "fs";

requiredFiles.forEach((file) => {
  const filePath = resolve(__dirname, file);
  if (existsSync(filePath)) {
    checks.passed.push(`✅ ${file.replace("../", "")} exists`);
  } else {
    checks.failed.push(`❌ ${file.replace("../", "")} is missing`);
  }
});

// Print results
console.log("\n" + "=".repeat(60));
console.log("📊 VERIFICATION RESULTS");
console.log("=".repeat(60) + "\n");

if (checks.passed.length > 0) {
  console.log("✅ PASSED CHECKS:");
  checks.passed.forEach((check) => console.log(`   ${check}`));
}

if (checks.warnings.length > 0) {
  console.log("\n⚠️  WARNINGS:");
  checks.warnings.forEach((warning) => console.log(`   ${warning}`));
}

if (checks.failed.length > 0) {
  console.log("\n❌ FAILED CHECKS:");
  checks.failed.forEach((failure) => console.log(`   ${failure}`));
}

console.log("\n" + "=".repeat(60));

if (checks.failed.length === 0) {
  console.log("✅ All required checks passed!");
  console.log("\n📝 Next steps:");
  console.log("   1. Configure Google OAuth in Supabase dashboard");
  console.log("   2. Set up Google Cloud Console credentials");
  console.log("   3. Test sign-in flow at http://localhost:3000/auth/login");
  console.log("\n📚 See docs/GOOGLE_AUTH_SETUP.md for detailed instructions");
} else {
  console.log("❌ Some checks failed. Please fix the issues above.");
  console.log("\n📚 See docs/GOOGLE_AUTH_SETUP.md for setup instructions");
  process.exit(1);
}

console.log("=".repeat(60) + "\n");