import { config } from "dotenv"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { customers } from "./schema/customers"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const dbSchema = {
  // tables
  customers
  // relations
}

// Reuse a single client/DB instance across hot reloads in dev to avoid
// exhausting pooled connections and causing CONNECT_TIMEOUT errors.
const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>
  __drizzleDb?: ReturnType<typeof drizzlePostgres<typeof dbSchema>>
}

if (!globalForDb.__pgClient) {
  // Set conservative pool options in dev.
  // - connect_timeout: fail fast if pooler is unreachable
  // - max: keep pool small to avoid many concurrent conns during HMR
  // - idle_timeout: close idle conns sooner
  globalForDb.__pgClient = postgres(databaseUrl, {
    prepare: false,
    connect_timeout: 10,
    max: 3,
    idle_timeout: 10
  })
}

if (!globalForDb.__drizzleDb) {
  globalForDb.__drizzleDb = drizzlePostgres(globalForDb.__pgClient, {
    schema: dbSchema
  })
}

export const db = globalForDb.__drizzleDb
