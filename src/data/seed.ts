import type { BackupData, CatalogItem, GlobalCost } from "@/data/types"
import { DEFAULT_SETTINGS } from "@/data/types"

function item(
  id: string,
  now: string,
  fields: Omit<CatalogItem, "id" | "createdAt" | "updatedAt">,
): CatalogItem {
  return { id, createdAt: now, updatedAt: now, ...fields }
}

export function createStarterBackup(now = new Date().toISOString()): BackupData {
  const catalog: CatalogItem[] = [
    item("seed-profile-150x50", now, {
      name: "פרופיל אלומיניום 150×50",
      category: "profiles",
      unit: "kg",
      pricePerKg: 25,
      kgPerMeter: 2.15,
    }),
    item("seed-screw-sheet", now, {
      name: "בורג פח 4.2×16",
      category: "screws",
      unit: "pack",
      packPrice: 100,
      packQty: 100,
    }),
    item("seed-screw-drill", now, {
      name: "בורג קידוח 4.8×25",
      category: "screws",
      unit: "pack",
      packPrice: 90,
      packQty: 100,
    }),
    item("seed-sheet", now, {
      name: "פח אלומיניום 0.7 מ״מ",
      category: "sheets",
      unit: "sqm",
      pricePerUnit: 95,
    }),
    item("seed-labor", now, {
      name: "שעת עבודה באתר",
      category: "labor",
      unit: "hour",
      pricePerUnit: 180,
    }),
    item("seed-transport", now, {
      name: "הובלה לאתר",
      category: "transport",
      unit: "unit",
      pricePerUnit: 300,
    }),
  ]

  const globalCosts: GlobalCost[] = [
    {
      id: "seed-waste",
      name: "פחת חומר",
      kind: "percent_materials",
      percent: 5,
      applyToNewProjects: true,
      createdAt: now,
      updatedAt: now,
    },
  ]

  return {
    version: 1,
    exportedAt: now,
    catalog,
    projects: [],
    lines: [],
    globalCosts,
    overheads: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}
