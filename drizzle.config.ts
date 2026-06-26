import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.DATABASE_PUBLIC_URL;

if (!databaseUrl) {
  const dbKeys = Object.keys(process.env).filter(k => k.includes("DATABASE") || k.includes("POSTGRES") || k.includes("PG"));
  console.error("DB-related env vars found:", dbKeys.join(", ") || "NONE");
  dbKeys.forEach(k => console.error(`  ${k} = "${(process.env[k] || "").substring(0, 15)}..." (length: ${(process.env[k] || "").length})`));
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
