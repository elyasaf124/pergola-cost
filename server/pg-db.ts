import { Pool, type PoolClient } from "pg"
import type { Database, Sql } from "./sql.ts"

function wrap(client: Pool | PoolClient): Sql {
  return {
    async query(text, params = []) {
      const result = await client.query(text, params as never[])
      return result.rows as unknown as Record<string, unknown>[]
    },
  }
}

export async function openPg(url: string): Promise<Database> {
  const pool = new Pool({ connectionString: url, max: 5 })
  await pool.query("SELECT 1")
  return {
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query("BEGIN")
        const result = await fn(wrap(client))
        await client.query("COMMIT")
        return result
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      } finally {
        client.release()
      }
    },
  }
}
