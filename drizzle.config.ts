import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Must be the Postgres connection string (e.g., postgresql://...)
    url: process.env.DATABASE_URL!
  }
});
