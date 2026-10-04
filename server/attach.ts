import { getRequestListener } from "@hono/node-server"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { createApp } from "./app.ts"
import { openDatabase } from "./db.ts"
import { loadEnvFile } from "./env.ts"

function apiMiddleware() {
  const listener = getRequestListener(createApp().fetch)
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const url = req.url ?? ""
    if (!url.startsWith("/api")) {
      next()
      return
    }
    void listener(req, res).catch(next)
  }
}

/** Attach the API only when a dev or preview server starts. `vite build` does not call this. */
export function apiPlugin(): Plugin {
  return {
    name: "pergola-api",
    async configureServer(server) {
      loadEnvFile(".env")
      await openDatabase()
      server.middlewares.use(apiMiddleware())
    },
    async configurePreviewServer(server) {
      loadEnvFile(".env")
      if (process.env.NODE_ENV === "production") loadEnvFile(".env.production")
      await openDatabase()
      server.middlewares.use(apiMiddleware())
    },
  }
}
