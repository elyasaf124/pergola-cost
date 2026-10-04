import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore"
import type {
  AppSettings,
  BackupData,
  CatalogItem,
  GlobalCost,
  Project,
  ProjectLine,
  ProjectOverhead,
  StoreMeta,
} from "@/data/types"
import { DEFAULT_SETTINGS } from "@/data/types"
import { createStarterBackup } from "@/data/seed"
import type { Repository } from "@/data/repository"
import { getFirestoreDb } from "@/lib/firebase"

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const COLLECTIONS = ["catalog", "projects", "lines", "globalCosts", "overheads"] as const

export function createFirestoreRepository(uid: string): Repository {
  const db = getFirestoreDb()

  function col(name: string) {
    return collection(db, "users", uid, name)
  }

  function ref(name: string, id: string) {
    return doc(db, "users", uid, name, id)
  }

  async function list<T>(name: string): Promise<T[]> {
    const snap = await getDocs(col(name))
    return snap.docs.map((entry) => entry.data() as T)
  }

  async function put(name: string, id: string, value: DocumentData): Promise<void> {
    await setDoc(ref(name, id), clean(value))
  }

  async function writeAll(data: BackupData, initialized: boolean): Promise<void> {
    for (const name of COLLECTIONS) {
      const snap = await getDocs(col(name))
      let batch = writeBatch(db)
      let count = 0
      const commit = async () => {
        if (count === 0) return
        await batch.commit()
        batch = writeBatch(db)
        count = 0
      }
      for (const entry of snap.docs) {
        batch.delete(entry.ref)
        count += 1
        if (count >= 400) await commit()
      }
      await commit()
    }

    const rows: Array<[string, string, DocumentData]> = [
      ...data.catalog.map((item) => ["catalog", item.id, item] as [string, string, DocumentData]),
      ...data.projects.map((item) => ["projects", item.id, item] as [string, string, DocumentData]),
      ...data.lines.map((item) => ["lines", item.id, item] as [string, string, DocumentData]),
      ...data.globalCosts.map((item) => ["globalCosts", item.id, item] as [string, string, DocumentData]),
      ...data.overheads.map((item) => ["overheads", item.id, item] as [string, string, DocumentData]),
    ]
    let batch = writeBatch(db)
    let count = 0
    for (const [name, id, value] of rows) {
      batch.set(ref(name, id), clean(value))
      count += 1
      if (count >= 400) {
        await batch.commit()
        batch = writeBatch(db)
        count = 0
      }
    }
    batch.set(ref("settings", "app"), clean(data.settings))
    batch.set(ref("meta", "app"), { initialized })
    await batch.commit()
  }

  return {
    mode: "firestore",
    async loadAll() {
      const [catalog, projects, lines, globalCosts, overheads, settingsSnap, metaSnap] =
        await Promise.all([
          list<CatalogItem>("catalog"),
          list<Project>("projects"),
          list<ProjectLine>("lines"),
          list<GlobalCost>("globalCosts"),
          list<ProjectOverhead>("overheads"),
          getDoc(ref("settings", "app")),
          getDoc(ref("meta", "app")),
        ])
      const meta = metaSnap.exists() ? (metaSnap.data() as StoreMeta) : undefined
      const settings = settingsSnap.exists() ? (settingsSnap.data() as AppSettings) : undefined
      const empty = catalog.length === 0 && projects.length === 0 && globalCosts.length === 0
      if (!meta?.initialized && empty) {
        const seeded = createStarterBackup()
        await writeAll(seeded, true)
        return seeded
      }
      if (!meta?.initialized) await setDoc(ref("meta", "app"), { initialized: true })
      if (!settings) await setDoc(ref("settings", "app"), DEFAULT_SETTINGS)
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        catalog,
        projects,
        lines,
        globalCosts,
        overheads,
        settings: settings ?? { ...DEFAULT_SETTINGS },
      }
    },
    async saveCatalogItem(item) {
      await put("catalog", item.id, item)
    },
    async deleteCatalogItem(id) {
      await deleteDoc(ref("catalog", id))
    },
    async saveProject(project) {
      await put("projects", project.id, project)
    },
    async deleteProject(id) {
      const [lines, overheads] = await Promise.all([
        getDocs(query(col("lines"), where("projectId", "==", id))),
        getDocs(query(col("overheads"), where("projectId", "==", id))),
      ])
      const batch = writeBatch(db)
      batch.delete(ref("projects", id))
      for (const entry of lines.docs) batch.delete(entry.ref)
      for (const entry of overheads.docs) batch.delete(entry.ref)
      await batch.commit()
    },
    async saveLine(line) {
      await put("lines", line.id, line)
    },
    async deleteLine(id) {
      await deleteDoc(ref("lines", id))
    },
    async saveGlobalCost(cost) {
      await put("globalCosts", cost.id, cost)
    },
    async deleteGlobalCost(id) {
      await deleteDoc(ref("globalCosts", id))
    },
    async saveOverhead(overhead) {
      await put("overheads", overhead.id, overhead)
    },
    async deleteOverhead(id) {
      await deleteDoc(ref("overheads", id))
    },
    async saveSettings(settings) {
      await put("settings", "app", settings)
    },
    async replaceAll(data) {
      await writeAll(data, true)
    },
  }
}
