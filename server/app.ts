import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { requireDatabase } from "./db.ts"
import { databaseUrl } from "./env.ts"
import { decideDatabase } from "./guard.ts"
import {
  createSessionToken,
  passwordMatches,
  passwordRequired,
  SESSION_COOKIE,
  sessionTokenValid,
} from "./session.ts"
import {
  deleteCatalogGroup,
  deleteCatalogItem,
  deleteGlobalCost,
  deleteLine,
  deleteOverhead,
  deleteProject,
  loadAll,
  replaceAll,
  saveCatalogGroup,
  saveCatalogItem,
  saveGlobalCost,
  saveLine,
  saveOverhead,
  saveProject,
  saveSettings,
  type BackupData,
  type CatalogGroupRow,
  type CatalogRow,
  type GlobalCostRow,
  type LineRow,
  type OverheadRow,
  type ProjectRow,
} from "./store.ts"

const MAX_AGE = 30 * 24 * 60 * 60

export function createApp(): Hono {
  const app = new Hono()

  app.onError((error, c) => {
    if (error instanceof ApiError) return c.json({ error: error.message }, error.status)
    console.error(error)
    return c.json({ error: "הבקשה נכשלה" }, 500)
  })

  app.use("/api/*", async (c, next) => {
    const path = c.req.path
    if (path === "/api/status" || path === "/api/login" || path === "/api/logout") return next()
    if (passwordRequired() && !sessionTokenValid(getCookie(c, SESSION_COOKIE))) {
      return c.json({ error: "נדרשת סיסמה" }, 401)
    }
    return next()
  })

  app.get("/api/status", (c) => {
    const decision = decideDatabase({
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: databaseUrl(),
    })
    if (!decision.ok) return c.json({ error: decision.message }, 500)
    const required = passwordRequired()
    return c.json({
      mode: decision.mode,
      passwordRequired: required,
      authenticated: !required || sessionTokenValid(getCookie(c, SESSION_COOKIE)),
    })
  })

  app.post("/api/login", async (c) => {
    if (!passwordRequired()) return c.json({ ok: true, authenticated: true })
    const body = await readJson<{ password?: string }>(c)
    if (!passwordMatches(body.password ?? "")) {
      return c.json({ error: "הסיסמה שגויה" }, 401)
    }
    setCookie(c, SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: MAX_AGE,
      secure:
        c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
        new URL(c.req.url).protocol === "https:",
    })
    return c.json({ ok: true, authenticated: true })
  })

  app.post("/api/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
    return c.json({ ok: true })
  })

  app.get("/api/data", async (c) => c.json(await loadAll(requireDatabase())))

  app.put("/api/catalog-groups", async (c) => {
    const body = await readJson<CatalogGroupRow>(c)
    if (!body.id || !body.name?.trim()) throw new ApiError("צריך שם לטבלה")
    await saveCatalogGroup(requireDatabase(), body)
    return c.json({ ok: true })
  })
  app.delete("/api/catalog-groups/:id", async (c) => {
    try {
      await deleteCatalogGroup(requireDatabase(), c.req.param("id"))
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "המחיקה נכשלה")
    }
    return c.json({ ok: true })
  })

  app.put("/api/catalog", async (c) => {
    await saveCatalogItem(requireDatabase(), await readJson<CatalogRow>(c))
    return c.json({ ok: true })
  })
  app.delete("/api/catalog/:id", async (c) => {
    await deleteCatalogItem(requireDatabase(), c.req.param("id"))
    return c.json({ ok: true })
  })

  app.put("/api/projects", async (c) => {
    await saveProject(requireDatabase(), await readJson<ProjectRow>(c))
    return c.json({ ok: true })
  })
  app.delete("/api/projects/:id", async (c) => {
    await deleteProject(requireDatabase(), c.req.param("id"))
    return c.json({ ok: true })
  })

  app.put("/api/lines", async (c) => {
    await saveLine(requireDatabase(), await readJson<LineRow>(c))
    return c.json({ ok: true })
  })
  app.delete("/api/lines/:id", async (c) => {
    await deleteLine(requireDatabase(), c.req.param("id"))
    return c.json({ ok: true })
  })

  app.put("/api/global-costs", async (c) => {
    await saveGlobalCost(requireDatabase(), await readJson<GlobalCostRow>(c))
    return c.json({ ok: true })
  })
  app.delete("/api/global-costs/:id", async (c) => {
    await deleteGlobalCost(requireDatabase(), c.req.param("id"))
    return c.json({ ok: true })
  })

  app.put("/api/overheads", async (c) => {
    await saveOverhead(requireDatabase(), await readJson<OverheadRow>(c))
    return c.json({ ok: true })
  })
  app.delete("/api/overheads/:id", async (c) => {
    await deleteOverhead(requireDatabase(), c.req.param("id"))
    return c.json({ ok: true })
  })

  app.put("/api/settings", async (c) => {
    const body = await readJson<{ vatRate?: number; includeVat?: boolean }>(c)
    if (typeof body.vatRate !== "number" || body.vatRate < 0 || body.vatRate > 100) {
      throw new ApiError("אחוז המע״מ צריך להיות בין 0 ל־100.")
    }
    await saveSettings(requireDatabase(), { vatRate: body.vatRate, includeVat: Boolean(body.includeVat) })
    return c.json({ ok: true })
  })

  app.put("/api/backup", async (c) => {
    const body = await readJson<Partial<BackupData>>(c)
    if (body.version !== 1) throw new ApiError("גרסת הגיבוי לא נתמכת")
    if (
      !Array.isArray(body.catalogGroups) ||
      !Array.isArray(body.catalog) ||
      !Array.isArray(body.projects) ||
      !Array.isArray(body.lines) ||
      !Array.isArray(body.globalCosts) ||
      !Array.isArray(body.overheads) ||
      !body.settings ||
      typeof body.settings.vatRate !== "number"
    ) {
      throw new ApiError("הקובץ אינו גיבוי תקין")
    }
    await replaceAll(requireDatabase(), {
      version: 1,
      exportedAt: typeof body.exportedAt === "string" ? body.exportedAt : new Date().toISOString(),
      catalogGroups: body.catalogGroups,
      catalog: body.catalog,
      projects: body.projects,
      lines: body.lines,
      globalCosts: body.globalCosts,
      overheads: body.overheads,
      settings: {
        vatRate: body.settings.vatRate,
        includeVat: Boolean(body.settings.includeVat),
      },
    })
    return c.json({ ok: true })
  })

  return app
}

class ApiError extends Error {
  readonly status: 400 | 401
  constructor(message: string, status: 400 | 401 = 400) {
    super(message)
    this.status = status
  }
}

async function readJson<T>(c: { req: { json: () => Promise<T> } }): Promise<T> {
  try {
    return await c.req.json()
  } catch {
    throw new ApiError("הבקשה אינה JSON תקין")
  }
}
