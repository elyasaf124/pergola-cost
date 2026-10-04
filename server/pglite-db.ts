import { mkdir } from "node:fs/promises"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import type { Database, Sql } from "./sql.ts"

export async function openPglite(dir = path.resolve("data/dev")): Promise<Database> {
  dir = path.resolve(dir)
  await mkdir(dir, { recursive: true })
  const db = new PGlite(dir)
  await db.waitReady

  const wrap = (queryable: { query: PGlite["query"] }): Sql => ({
    async query(text, params = []) {
      const result = await queryable.query(text, params)
      return result.rows as unknown as Record<string, unknown>[]
    },
  })

  return {
    ...wrap(db),
    transaction(fn) {
      return db.transaction((tx) => fn(wrap(tx)))
    },
  }
}
