import type { CatalogItem, GlobalCost, ProjectLine, ProjectOverhead } from "@/data/types"
import { catalogUnitPrice, type Category, type PriceUnit } from "@/lib/pricing"

export function createId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function lineFromCatalog(projectId: string, item: CatalogItem, quantity: number): ProjectLine {
  const now = nowIso()
  return {
    id: createId(),
    projectId,
    catalogItemId: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity,
    unitPrice: catalogUnitPrice(item),
    pricePerKg: item.pricePerKg,
    kgPerMeter: item.kgPerMeter,
    packPrice: item.packPrice,
    packQty: item.packQty,
    createdAt: now,
    updatedAt: now,
  }
}

export function freeformLine(input: {
  projectId: string
  name: string
  category: Category
  unit: PriceUnit
  quantity: number
  unitPrice: number
}): ProjectLine {
  const now = nowIso()
  return {
    id: createId(),
    projectId: input.projectId,
    catalogItemId: null,
    name: input.name,
    category: input.category,
    unit: input.unit,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    createdAt: now,
    updatedAt: now,
  }
}

export function overheadFromGlobal(projectId: string, cost: GlobalCost): ProjectOverhead {
  const now = nowIso()
  return {
    id: createId(),
    projectId,
    globalCostId: cost.id,
    name: cost.name,
    kind: cost.kind,
    amount: cost.amount,
    percent: cost.percent,
    hours: cost.hours,
    hourlyRate: cost.hourlyRate,
    createdAt: now,
    updatedAt: now,
  }
}
