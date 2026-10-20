import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createApiRepository, fetchStatus, login as loginRequest, logout as logoutRequest } from "@/data/api"
import { parseBackup } from "@/data/backup"
import type { Repository } from "@/data/repository"
import type { ServerStatus } from "@/data/api"
import type {
  AppSettings,
  BackupData,
  CatalogGroup,
  CatalogItem,
  GlobalCost,
  Project,
  ProjectLine,
  ProjectOverhead,
} from "@/data/types"
import { DEFAULT_SETTINGS } from "@/data/types"
import { normalizeCatalogGroups } from "@/lib/catalog-groups"
import { createId, nowIso, overheadFromGlobal } from "@/lib/records"

export type ProjectDraft = Omit<Project, "id" | "createdAt" | "updatedAt">

interface DataApi {
  ready: boolean
  loading: boolean
  locked: boolean
  error: string | null
  mode: "development" | "production"
  passwordRequired: boolean
  authenticated: boolean
  catalogGroups: CatalogGroup[]
  catalog: CatalogItem[]
  projects: Project[]
  lines: ProjectLine[]
  globalCosts: GlobalCost[]
  overheads: ProjectOverhead[]
  settings: AppSettings
  reload: () => Promise<void>
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
  saveCatalogGroup: (group: CatalogGroup) => Promise<void>
  deleteCatalogGroup: (id: string) => Promise<void>
  saveCatalogItem: (item: CatalogItem) => Promise<void>
  deleteCatalogItem: (id: string) => Promise<void>
  createProject: (draft: ProjectDraft) => Promise<Project>
  saveProject: (project: Project) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  saveLine: (line: ProjectLine) => Promise<void>
  deleteLine: (id: string) => Promise<void>
  saveGlobalCost: (cost: GlobalCost) => Promise<void>
  deleteGlobalCost: (id: string) => Promise<void>
  saveOverhead: (overhead: ProjectOverhead) => Promise<void>
  deleteOverhead: (id: string) => Promise<void>
  saveSettings: (settings: AppSettings) => Promise<void>
  exportBackup: () => BackupData
  importBackup: (input: unknown) => Promise<void>
}

const DataContext = createContext<DataApi | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [data, setData] = useState<BackupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const repoRef = useRef<Repository | null>(null)
  const dataRef = useRef<BackupData | null>(null)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchStatus()
      .then(async (nextStatus) => {
        if (cancelled) return
        setStatus(nextStatus)
        const locked = nextStatus.passwordRequired && !nextStatus.authenticated
        if (locked) {
          repoRef.current = null
          dataRef.current = null
          setData(null)
          setLoading(false)
          return
        }
        const repo = createApiRepository(nextStatus.mode)
        repoRef.current = repo
        const loaded = await repo.loadAll()
        const normalized = {
          ...loaded,
          catalogGroups: normalizeCatalogGroups(
            loaded.catalogGroups,
            loaded.catalog.map((item) => item.category),
          ),
        }
        if (cancelled) return
        dataRef.current = normalized
        setData(normalized)
        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error(err)
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : "לא הצלחנו לטעון את הנתונים. בדקו שהשרת רץ ונסו שוב.",
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const locked = Boolean(status?.passwordRequired && !status.authenticated)

  const api = useMemo<DataApi>(() => {
    const settings = data?.settings ?? DEFAULT_SETTINGS

    async function mutate(
      update: (current: BackupData) => BackupData,
      write: (repo: Repository) => Promise<void>,
    ) {
      const repo = repoRef.current
      const previous = dataRef.current
      if (!repo || !previous) throw new Error("הנתונים עדיין נטענים")
      const next = update(structuredClone(previous))
      dataRef.current = next
      setData(next)
      try {
        await write(repo)
      } catch (err) {
        dataRef.current = previous
        setData(previous)
        throw err
      }
    }

    return {
      ready: !loading && data != null && error == null && !locked,
      loading,
      locked,
      error,
      mode: status?.mode ?? "development",
      passwordRequired: Boolean(status?.passwordRequired),
      authenticated: Boolean(status?.authenticated),
      catalogGroups: data?.catalogGroups ?? normalizeCatalogGroups(undefined, []),
      catalog: data?.catalog ?? [],
      projects: data?.projects ?? [],
      lines: data?.lines ?? [],
      globalCosts: data?.globalCosts ?? [],
      overheads: data?.overheads ?? [],
      settings,
      reload: async () => {
        setReloadKey((value) => value + 1)
      },
      login: async (password: string) => {
        await loginRequest(password)
        setReloadKey((value) => value + 1)
      },
      logout: async () => {
        await logoutRequest()
        setReloadKey((value) => value + 1)
      },
      saveCatalogGroup: (group) =>
        mutate(
          (current) => ({ ...current, catalogGroups: upsert(current.catalogGroups, group) }),
          (repo) => repo.saveCatalogGroup(group),
        ),
      deleteCatalogGroup: (id) =>
        mutate(
          (current) => ({
            ...current,
            catalogGroups: current.catalogGroups.filter((group) => group.id !== id),
          }),
          (repo) => repo.deleteCatalogGroup(id),
        ),
      saveCatalogItem: (item) =>
        mutate(
          (current) => ({ ...current, catalog: upsert(current.catalog, item) }),
          (repo) => repo.saveCatalogItem(item),
        ),
      deleteCatalogItem: (id) =>
        mutate(
          (current) => ({
            ...current,
            catalog: current.catalog.filter((item) => item.id !== id),
          }),
          (repo) => repo.deleteCatalogItem(id),
        ),
      createProject: async (draft) => {
        const current = dataRef.current
        if (!current) throw new Error("הנתונים עדיין נטענים")
        const now = nowIso()
        const project: Project = { ...draft, id: createId(), createdAt: now, updatedAt: now }
        const overheads = current.globalCosts
          .filter((cost) => cost.applyToNewProjects)
          .map((cost) => overheadFromGlobal(project.id, cost))
        await mutate(
          (snapshot) => ({
            ...snapshot,
            projects: [project, ...snapshot.projects],
            overheads: [...snapshot.overheads, ...overheads],
          }),
          async (repo) => {
            await repo.saveProject(project)
            for (const overhead of overheads) await repo.saveOverhead(overhead)
          },
        )
        return project
      },
      saveProject: (project) => {
        const next = { ...project, updatedAt: nowIso() }
        return mutate(
          (current) => ({ ...current, projects: upsert(current.projects, next) }),
          (repo) => repo.saveProject(next),
        )
      },
      deleteProject: (id) =>
        mutate(
          (current) => ({
            ...current,
            projects: current.projects.filter((project) => project.id !== id),
            lines: current.lines.filter((line) => line.projectId !== id),
            overheads: current.overheads.filter((overhead) => overhead.projectId !== id),
          }),
          (repo) => repo.deleteProject(id),
        ),
      saveLine: (line) =>
        mutate(
          (current) => ({ ...current, lines: upsert(current.lines, line) }),
          (repo) => repo.saveLine(line),
        ),
      deleteLine: (id) =>
        mutate(
          (current) => ({
            ...current,
            lines: current.lines.filter((line) => line.id !== id),
          }),
          (repo) => repo.deleteLine(id),
        ),
      saveGlobalCost: (cost) =>
        mutate(
          (current) => ({ ...current, globalCosts: upsert(current.globalCosts, cost) }),
          (repo) => repo.saveGlobalCost(cost),
        ),
      deleteGlobalCost: (id) =>
        mutate(
          (current) => ({
            ...current,
            globalCosts: current.globalCosts.filter((cost) => cost.id !== id),
          }),
          (repo) => repo.deleteGlobalCost(id),
        ),
      saveOverhead: (overhead) =>
        mutate(
          (current) => ({ ...current, overheads: upsert(current.overheads, overhead) }),
          (repo) => repo.saveOverhead(overhead),
        ),
      deleteOverhead: (id) =>
        mutate(
          (current) => ({
            ...current,
            overheads: current.overheads.filter((overhead) => overhead.id !== id),
          }),
          (repo) => repo.deleteOverhead(id),
        ),
      saveSettings: (next) =>
        mutate(
          (current) => ({ ...current, settings: next }),
          (repo) => repo.saveSettings(next),
        ),
      exportBackup: () => {
        const current = dataRef.current
        if (!current) throw new Error("הנתונים עדיין נטענים")
        return { ...current, exportedAt: new Date().toISOString() }
      },
      importBackup: async (input) => {
        const parsed = parseBackup(input)
        await mutate(
          () => parsed,
          (repo) => repo.replaceAll(parsed),
        )
      },
    }
  }, [data, error, loading, locked, status])

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>
}

export function useData(): DataApi {
  const value = useContext(DataContext)
  if (!value) throw new Error("useData must be used inside DataProvider")
  return value
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((entry) => entry.id === item.id)
  if (index === -1) return [item, ...items]
  const next = items.slice()
  next[index] = item
  return next
}
