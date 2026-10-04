import type { BackupData } from "@/data/types"
import { DEFAULT_SETTINGS } from "@/data/types"

export function parseBackup(input: unknown): BackupData {
  if (!input || typeof input !== "object") {
    throw new Error("הקובץ אינו גיבוי תקין")
  }
  const data = input as Partial<BackupData>
  if (data.version !== 1) throw new Error("גרסת הגיבוי לא נתמכת")
  if (
    !Array.isArray(data.catalog) ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.lines) ||
    !Array.isArray(data.globalCosts) ||
    !Array.isArray(data.overheads)
  ) {
    throw new Error("הקובץ חסר נתונים")
  }
  if (!data.settings || typeof data.settings.vatRate !== "number") {
    throw new Error("הגדרות המע״מ חסרות בגיבוי")
  }
  return {
    version: 1,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    catalog: data.catalog,
    projects: data.projects,
    lines: data.lines,
    globalCosts: data.globalCosts,
    overheads: data.overheads,
    settings: {
      vatRate: data.settings.vatRate,
      includeVat: Boolean(data.settings.includeVat),
    },
  }
}

export function emptyBackup(): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    catalog: [],
    projects: [],
    lines: [],
    globalCosts: [],
    overheads: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}
