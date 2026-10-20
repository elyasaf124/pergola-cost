import type { CatalogGroup, ProjectLine } from "@/data/types"
import type { CostLineInput, PricingRole } from "@/lib/pricing"

export const BUILTIN_GROUP_IDS = new Set([
  "profiles",
  "screws",
  "sheets",
  "paint",
  "labor",
  "transport",
  "other",
])

export const DEFAULT_CATALOG_GROUPS: Array<{
  id: string
  name: string
  sortOrder: number
  pricingRole: PricingRole
}> = [
  { id: "profiles", name: "פרופילים", sortOrder: 10, pricingRole: "materials" },
  { id: "screws", name: "ברגים", sortOrder: 20, pricingRole: "screws" },
  { id: "sheets", name: "לוחות", sortOrder: 30, pricingRole: "materials" },
  { id: "paint", name: "צבע", sortOrder: 40, pricingRole: "materials" },
  { id: "labor", name: "עבודה", sortOrder: 50, pricingRole: "labor" },
  { id: "transport", name: "הובלה", sortOrder: 60, pricingRole: "transport" },
  { id: "other", name: "אחר", sortOrder: 70, pricingRole: "materials" },
]

export function legacyPricingRole(categoryId: string): PricingRole {
  if (categoryId === "screws") return "screws"
  if (categoryId === "labor") return "labor"
  if (categoryId === "transport") return "transport"
  return "materials"
}

export function pricingRoleForCategory(
  categoryId: string,
  groups: CatalogGroup[],
): PricingRole {
  const group = groups.find((entry) => entry.id === categoryId)
  return group?.pricingRole ?? legacyPricingRole(categoryId)
}

export function categoryLabel(categoryId: string, groups: CatalogGroup[]): string {
  const group = groups.find((entry) => entry.id === categoryId)
  if (group) return group.name
  const fallback = DEFAULT_CATALOG_GROUPS.find((entry) => entry.id === categoryId)
  return fallback?.name ?? categoryId
}

export function sortCatalogGroups(groups: CatalogGroup[]): CatalogGroup[] {
  return [...groups].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name, "he")
  })
}

export function defaultCatalogGroups(now = new Date().toISOString()): CatalogGroup[] {
  return DEFAULT_CATALOG_GROUPS.map((entry) => ({
    id: entry.id,
    name: entry.name,
    sortOrder: entry.sortOrder,
    pricingRole: entry.pricingRole,
    createdAt: now,
    updatedAt: now,
  }))
}

/** Old backups without catalogGroups still open with the built-in tables. */
export function normalizeCatalogGroups(
  groups: CatalogGroup[] | undefined,
  catalogCategoryIds: string[],
): CatalogGroup[] {
  const now = new Date().toISOString()
  const map = new Map<string, CatalogGroup>()
  for (const entry of groups ?? defaultCatalogGroups(now)) {
    map.set(entry.id, entry)
  }
  for (const entry of defaultCatalogGroups(now)) {
    if (!map.has(entry.id)) map.set(entry.id, entry)
  }
  let nextOrder =
    Math.max(0, ...[...map.values()].map((entry) => entry.sortOrder)) + 10
  for (const categoryId of catalogCategoryIds) {
    if (map.has(categoryId)) continue
    map.set(categoryId, {
      id: categoryId,
      name: categoryId,
      sortOrder: nextOrder,
      pricingRole: legacyPricingRole(categoryId),
      createdAt: now,
      updatedAt: now,
    })
    nextOrder += 10
  }
  return sortCatalogGroups([...map.values()])
}

export function nextCatalogGroupSortOrder(groups: CatalogGroup[]): number {
  if (groups.length === 0) return 10
  return Math.max(...groups.map((group) => group.sortOrder)) + 10
}

export function projectCostLines(lines: ProjectLine[], groups: CatalogGroup[]): CostLineInput[] {
  return lines.map((line) => ({
    category: line.category,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    pricingRole: pricingRoleForCategory(line.category, groups),
  }))
}
