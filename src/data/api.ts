import type {
  AppSettings,
  BackupData,
  CatalogItem,
  GlobalCost,
  Project,
  ProjectLine,
  ProjectOverhead,
} from "@/data/types"
import type { Repository } from "@/data/repository"

export interface ServerStatus {
  mode: "development" | "production"
  passwordRequired: boolean
  authenticated: boolean
}

async function readError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return payload?.error || "הבקשה נכשלה"
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include" })
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as T
}

async function send(path: string, method: string, body?: unknown): Promise<void> {
  await request(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function fetchStatus(): Promise<ServerStatus> {
  return request<ServerStatus>("/api/status")
}

export function login(password: string): Promise<void> {
  return send("/api/login", "POST", { password })
}

export function logout(): Promise<void> {
  return send("/api/logout", "POST")
}

export function createApiRepository(mode: ServerStatus["mode"]): Repository {
  return {
    mode,
    loadAll: () => request<BackupData>("/api/data"),
    saveCatalogItem: (item: CatalogItem) => send("/api/catalog", "PUT", item),
    deleteCatalogItem: (id: string) => send(`/api/catalog/${encodeURIComponent(id)}`, "DELETE"),
    saveProject: (project: Project) => send("/api/projects", "PUT", project),
    deleteProject: (id: string) => send(`/api/projects/${encodeURIComponent(id)}`, "DELETE"),
    saveLine: (line: ProjectLine) => send("/api/lines", "PUT", line),
    deleteLine: (id: string) => send(`/api/lines/${encodeURIComponent(id)}`, "DELETE"),
    saveGlobalCost: (cost: GlobalCost) => send("/api/global-costs", "PUT", cost),
    deleteGlobalCost: (id: string) => send(`/api/global-costs/${encodeURIComponent(id)}`, "DELETE"),
    saveOverhead: (overhead: ProjectOverhead) => send("/api/overheads", "PUT", overhead),
    deleteOverhead: (id: string) => send(`/api/overheads/${encodeURIComponent(id)}`, "DELETE"),
    saveSettings: (settings: AppSettings) => send("/api/settings", "PUT", settings),
    replaceAll: (data: BackupData) => send("/api/backup", "PUT", data),
  }
}
