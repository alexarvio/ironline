import { defineConfig } from "drizzle-kit";

// Generates the SQL migrations in ./drizzle from app/lib/pg/schema.ts:
//   npx drizzle-kit generate
// Applying them needs no connection string here: the app runs them itself
// at startup (app/lib/pg/store.ts), against DATABASE_URL on Railway.
export default defineConfig({
  dialect: "postgresql",
  schema: "./app/lib/pg/schema.ts",
  out: "./drizzle",
});
