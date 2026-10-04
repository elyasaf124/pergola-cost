/**
 * The browser always talks to the server API.
 * `npm run dev` uses the local database in `data/dev`.
 * `npm start` uses the Neon database from `DATABASE_URL`.
 */
export { createApiRepository, fetchStatus, login, logout } from "@/data/api"
export type { Repository } from "@/data/repository"
export type { ServerStatus } from "@/data/api"
