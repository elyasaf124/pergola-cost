import { databaseUrl } from "./env.ts"

export type DatabaseMode = "development" | "production"

export type DatabaseDecision =
  | { ok: true; mode: DatabaseMode }
  | { ok: false; message: string }

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"])

export function databaseHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}

export function decideDatabase(input: {
  nodeEnv: string | undefined
  databaseUrl: string | undefined
}): DatabaseDecision {
  const mode: DatabaseMode = input.nodeEnv === "production" ? "production" : "development"
  const url = (input.databaseUrl ?? "").trim()
  const host = url ? databaseHost(url) : ""

  if (mode === "development") {
    if (url && host.includes("neon.tech")) {
      return {
        ok: false,
        message: [
          "Dev mode will not touch production.",
          "DATABASE_URL points at neon.tech. npm run dev only uses the local database in data/dev.",
          "Remove DATABASE_URL from the environment and from .env, then start again.",
          "מצב פיתוח לא נוגע בייצור ולא פותח חיבור אל Neon.",
        ].join("\n"),
      }
    }
    return { ok: true, mode: "development" }
  }

  if (!url) {
    return {
      ok: false,
      message: [
        "Production requires a Neon DATABASE_URL. npm start will not run without it.",
        "בייצור חובה DATABASE_URL של Neon. אין מסד מקומי.",
      ].join("\n"),
    }
  }

  if (!host || LOCAL_HOSTS.has(host)) {
    return {
      ok: false,
      message: [
        "Production will not use a localhost database. DATABASE_URL must be the Neon connection string.",
        "בייצור אסור להתחבר ל-localhost.",
      ].join("\n"),
    }
  }

  return { ok: true, mode: "production" }
}

export function assertDatabaseAllowed(): DatabaseMode {
  const decision = decideDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: databaseUrl(),
  })
  if (!decision.ok) {
    console.error(decision.message)
    process.exit(1)
  }
  if (decision.mode === "development" && databaseUrl()) {
    console.warn("Dev mode ignores DATABASE_URL and uses the local database in data/dev.")
  }
  return decision.mode
}
