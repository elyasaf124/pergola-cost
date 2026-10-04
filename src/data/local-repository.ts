import { openDB, type DBSchema, type IDBPDatabase } from "idb"
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

interface PergolaDB extends DBSchema {
  catalog: { key: string; value: CatalogItem }
  projects: { key: string; value: Project }
  lines: { key: string; value: ProjectLine; indexes: { "by-project": string } }
  globalCosts: { key: string; value: GlobalCost }
  overheads: { key: string; value: ProjectOverhead; indexes: { "by-project": string } }
  settings: { key: string; value: AppSettings }
  meta: { key: string; value: StoreMeta }
}

const dbPromise: Promise<IDBPDatabase<PergolaDB>> = openDB<PergolaDB>("pergolacost", 1, {
  upgrade(db) {
    db.createObjectStore("catalog", { keyPath: "id" })
    db.createObjectStore("projects", { keyPath: "id" })
    const lines = db.createObjectStore("lines", { keyPath: "id" })
    lines.createIndex("by-project", "projectId")
    db.createObjectStore("globalCosts", { keyPath: "id" })
    const overheads = db.createObjectStore("overheads", { keyPath: "id" })
    overheads.createIndex("by-project", "projectId")
    db.createObjectStore("settings")
    db.createObjectStore("meta")
  },
})

async function writeBackup(data: BackupData, initialized: boolean): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction(
    ["catalog", "projects", "lines", "globalCosts", "overheads", "settings", "meta"],
    "readwrite",
  )
  tx.objectStore("catalog").clear()
  tx.objectStore("projects").clear()
  tx.objectStore("lines").clear()
  tx.objectStore("globalCosts").clear()
  tx.objectStore("overheads").clear()
  for (const item of data.catalog) tx.objectStore("catalog").put(item)
  for (const project of data.projects) tx.objectStore("projects").put(project)
  for (const line of data.lines) tx.objectStore("lines").put(line)
  for (const cost of data.globalCosts) tx.objectStore("globalCosts").put(cost)
  for (const overhead of data.overheads) tx.objectStore("overheads").put(overhead)
  tx.objectStore("settings").put(data.settings, "app")
  tx.objectStore("meta").put({ initialized }, "app")
  await tx.done
}

export function createLocalRepository(): Repository {
  return {
    mode: "local",
    async loadAll() {
      const db = await dbPromise
      const [catalog, projects, lines, globalCosts, overheads, settings, meta] = await Promise.all([
        db.getAll("catalog"),
        db.getAll("projects"),
        db.getAll("lines"),
        db.getAll("globalCosts"),
        db.getAll("overheads"),
        db.get("settings", "app"),
        db.get("meta", "app"),
      ])
      const empty = catalog.length === 0 && projects.length === 0 && globalCosts.length === 0
      if (!meta?.initialized && empty) {
        const seeded = createStarterBackup()
        await writeBackup(seeded, true)
        return seeded
      }
      if (!meta?.initialized) {
        await db.put("meta", { initialized: true }, "app")
      }
      if (!settings) {
        await db.put("settings", DEFAULT_SETTINGS, "app")
      }
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
      const db = await dbPromise
      await db.put("catalog", item)
    },
    async deleteCatalogItem(id) {
      const db = await dbPromise
      await db.delete("catalog", id)
    },
    async saveProject(project) {
      const db = await dbPromise
      await db.put("projects", project)
    },
    async deleteProject(id) {
      const db = await dbPromise
      const tx = db.transaction(["projects", "lines", "overheads"], "readwrite")
      const lines = await tx.objectStore("lines").index("by-project").getAll(id)
      const overheads = await tx.objectStore("overheads").index("by-project").getAll(id)
      tx.objectStore("projects").delete(id)
      for (const line of lines) tx.objectStore("lines").delete(line.id)
      for (const overhead of overheads) tx.objectStore("overheads").delete(overhead.id)
      await tx.done
    },
    async saveLine(line) {
      const db = await dbPromise
      await db.put("lines", line)
    },
    async deleteLine(id) {
      const db = await dbPromise
      await db.delete("lines", id)
    },
    async saveGlobalCost(cost) {
      const db = await dbPromise
      await db.put("globalCosts", cost)
    },
    async deleteGlobalCost(id) {
      const db = await dbPromise
      await db.delete("globalCosts", id)
    },
    async saveOverhead(overhead) {
      const db = await dbPromise
      await db.put("overheads", overhead)
    },
    async deleteOverhead(id) {
      const db = await dbPromise
      await db.delete("overheads", id)
    },
    async saveSettings(settings) {
      const db = await dbPromise
      await db.put("settings", settings, "app")
    },
    async replaceAll(data) {
      await writeBackup(data, true)
    },
  }
}
