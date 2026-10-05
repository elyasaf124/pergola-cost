import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { createApp } from "./app.ts"
import { openDatabase } from "./db.ts"
import { loadEnvFile } from "./env.ts"

loadEnvFile(".env")
loadEnvFile(".env.production")
await openDatabase()

const app = createApp()
app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/api")) return next()
  return serveStatic({ root: "./dist" })(c, next)
})
app.get("*", async (c, next) => {
  if (c.req.path.startsWith("/api")) return c.json({ error: "לא נמצא" }, 404)
  return serveStatic({ path: "./dist/index.html" })(c, next)
})

const port = Number(process.env.PORT) || 5391
serve({ fetch: app.fetch, hostname: "0.0.0.0", port }, (info) => {
  console.log(`עלות פרגולה מאזינה על http://${info.address}:${info.port}`)
})
