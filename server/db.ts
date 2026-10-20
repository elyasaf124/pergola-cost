import { SCHEMA_SQL } from "./schema.ts"
import { ensureCatalogGroups, ensureSettings, seedIfEmpty } from "./seed.ts"
import type { Database } from "./sql.ts"
import { assertDatabaseAllowed } from "./guard.ts"
import { databaseUrl } from "./env.ts"

const globalDb = globalThis as typeof globalThis & { __pergolaDb?: Database }

/** Idempotent schema + catalog group rows. Safe on every server start and after code updates. */
async function migrateDatabase(database: Database): Promise<void> {
  for (const statement of SCHEMA_SQL) {
    await database.query(statement)
  }
  await ensureSettings(database)
  await ensureCatalogGroups(database)
}

export async function openDatabase(): Promise<Database> {
  if (globalDb.__pergolaDb) {
    await migrateDatabase(globalDb.__pergolaDb)
    return globalDb.__pergolaDb
  }
  const mode = assertDatabaseAllowed()
  const database =
    mode === "development"
      ? await (await import("./pglite-db.ts")).openPglite()
      : await (await import("./pg-db.ts")).openPg(databaseUrl())
  await migrateDatabase(database)
  await seedIfEmpty(database)
  globalDb.__pergolaDb = database
  return database
}

export function requireDatabase(): Database {
  const database = globalDb.__pergolaDb
  if (!database) throw new Error("המסד לא נפתח")
  return database
}
