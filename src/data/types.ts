import type { Category, OverheadKind, PriceUnit, PricingRole } from "@/lib/pricing"

export type { PricingRole }

export interface CatalogGroup {
  id: string
  name: string
  sortOrder: number
  pricingRole: PricingRole
  createdAt: string
  updatedAt: string
}

export type ProjectStatus = "quote" | "in_progress" | "done"

export interface CatalogItem {
  id: string
  name: string
  category: Category
  unit: PriceUnit
  pricePerKg?: number
  kgPerMeter?: number
  pricePerUnit?: number
  packPrice?: number
  packQty?: number
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  customerName: string
  phone: string
  address: string
  widthM: number | null
  depthM: number | null
  heightM: number | null
  notes: string
  status: ProjectStatus
  sellingPrice: number | null
  createdAt: string
  updatedAt: string
}

export interface ProjectLine {
  id: string
  projectId: string
  catalogItemId: string | null
  name: string
  category: Category
  unit: PriceUnit
  quantity: number
  unitPrice: number
  pricePerKg?: number
  kgPerMeter?: number
  packPrice?: number
  packQty?: number
  createdAt: string
  updatedAt: string
}

export interface GlobalCost {
  id: string
  name: string
  kind: OverheadKind
  amount?: number
  percent?: number
  hours?: number
  hourlyRate?: number
  applyToNewProjects: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectOverhead {
  id: string
  projectId: string
  globalCostId: string | null
  name: string
  kind: OverheadKind
  amount?: number
  percent?: number
  hours?: number
  hourlyRate?: number
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  vatRate: number
  includeVat: boolean
}

export interface BackupData {
  version: 1
  exportedAt: string
  catalogGroups: CatalogGroup[]
  catalog: CatalogItem[]
  projects: Project[]
  lines: ProjectLine[]
  globalCosts: GlobalCost[]
  overheads: ProjectOverhead[]
  settings: AppSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  vatRate: 18,
  includeVat: false,
}
