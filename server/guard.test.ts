import { describe, expect, it } from "vitest"
import { decideDatabase } from "./guard.ts"

describe("database mode", () => {
  it("uses the local database in development and refuses Neon", () => {
    expect(decideDatabase({ nodeEnv: "development", databaseUrl: "" }).ok).toBe(true)
    const refused = decideDatabase({
      nodeEnv: "development",
      databaseUrl: "postgresql://user:pass@ep-cool-pooler.eu-central-1.aws.neon.tech/neondb",
    })
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.message).toContain("Dev mode will not touch production.")
  })

  it("requires a non-local DATABASE_URL in production", () => {
    expect(decideDatabase({ nodeEnv: "production", databaseUrl: "" }).ok).toBe(false)
    const local = decideDatabase({
      nodeEnv: "production",
      databaseUrl: "postgresql://user:pass@localhost:5432/pergola",
    })
    expect(local.ok).toBe(false)
    if (!local.ok) expect(local.message).toContain("localhost")
    expect(
      decideDatabase({
        nodeEnv: "production",
        databaseUrl: "postgresql://user:pass@ep-cool.eu-central-1.aws.neon.tech/neondb",
      }).ok,
    ).toBe(true)
  })
})
