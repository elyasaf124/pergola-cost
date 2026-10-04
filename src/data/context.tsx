import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { User } from "firebase/auth"
import { parseBackup } from "@/data/backup"
import {
  createFirestoreRepository,
  createLocalRepository,
  type Repository,
} from "@/data/index"
import type {
  AppSettings,
  BackupData,
  CatalogItem,
  GlobalCost,
  Project,
  ProjectLine,
  ProjectOverhead,
} from "@/data/types"
import { DEFAULT_SETTINGS } from "@/data/types"
import {
  authErrorMessage,
  completeGoogleRedirect,
  isFirebaseConfigured,
  signInWithGoogle,
  signOutGoogle,
  watchAuth,
} from "@/lib/firebase"
import { createId, nowIso, overheadFromGlobal } from "@/lib/records"

export type ProjectDraft = Omit<Project, "id" | "createdAt" | "updatedAt">

interface SessionUser {
  uid: string
  email: string | null
  displayName: string | null
}

interface DataApi {
  ready: boolean
  loading: boolean
  error: string | null
  mode: "local" | "firestore"
  firebaseConfigured: boolean
  user: SessionUser | null
  catalog: CatalogItem[]
  projects: Project[]
  lines: ProjectLine[]
  globalCosts: GlobalCost[]
  overheads: ProjectOverhead[]
  settings: AppSettings
  reload: () => Promise<void>
  signIn: () => Promise<void>
  signOut: () => Promise<void>
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
  copyLocalToAccount: () => Promise<void>
}

const DataContext = createContext<DataApi | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!configured)
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
    if (!configured) {
      setAuthReady(true)
      return
    }
    let active = true
    void completeGoogleRedirect().catch((err) => {
      console.warn("Google redirect result failed", err)
    })
    const unsubscribe = watchAuth((next) => {
      if (!active) return
      setUser(next)
      setAuthReady(true)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [configured])

  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    const repo =
      configured && user ? createFirestoreRepository(user.uid) : createLocalRepository()
    repoRef.current = repo
    setLoading(true)
    setError(null)
    setData(null)
    dataRef.current = null
    repo
      .loadAll()
      .then((loaded) => {
        if (cancelled) return
        dataRef.current = loaded
        setData(loaded)
        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error(err)
        if (cancelled) return
        setError("לא הצלחנו לטעון את הנתונים. בדקו את החיבור ונסו שוב.")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authReady, configured, user, reloadKey])

  const api = useMemo<DataApi>(() => {
    const mode: "local" | "firestore" = configured && user ? "firestore" : "local"
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
      ready: authReady && !loading && data != null && error == null,
      loading: !authReady || loading,
      error,
      mode,
      firebaseConfigured: configured,
      user: user
        ? { uid: user.uid, email: user.email, displayName: user.displayName }
        : null,
      catalog: data?.catalog ?? [],
      projects: data?.projects ?? [],
      lines: data?.lines ?? [],
      globalCosts: data?.globalCosts ?? [],
      overheads: data?.overheads ?? [],
      settings,
      reload: async () => {
        setReloadKey((value) => value + 1)
      },
      signIn: async () => {
        if (!configured) throw new Error("Firebase לא הוגדר במכשיר הזה.")
        try {
          await signInWithGoogle()
        } catch (err) {
          throw new Error(authErrorMessage(err))
        }
      },
      signOut: async () => {
        await signOutGoogle()
      },
      saveCatalogItem: (item) =>
        mutate(
          (current) => ({
            ...current,
            catalog: upsert(current.catalog, item),
          }),
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
          (current) => ({
            ...current,
            projects: upsert(current.projects, next),
          }),
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
      copyLocalToAccount: async () => {
        if (mode !== "firestore") {
          throw new Error("אפשר להעתיק לחשבון רק אחרי התחברות.")
        }
        const local = await createLocalRepository().loadAll()
        await mutate(
          () => local,
          (repo) => repo.replaceAll(local),
        )
      },
    }
  }, [authReady, configured, data, error, loading, user])

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
