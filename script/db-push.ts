import { execSync } from "child_process";

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_PUBLIC_URL;

if (!dbUrl) {
  const allVars = Object.keys(process.env).sort().join(", ");
  console.error("No DATABASE_URL found. All env vars:", allVars);
  process.exit(1);
}

console.log("DATABASE_URL found (length:", dbUrl.length, "), running drizzle-kit push...");

try {
  execSync("npx drizzle-kit push", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  console.log("Schema push complete!");
} catch (err) {
  console.error("Schema push failed:", err);
  process.exit(1);
}