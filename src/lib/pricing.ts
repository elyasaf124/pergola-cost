export type Category =
  | "profiles"
  | "screws"
  | "sheets"
  | "paint"
  | "labor"
  | "transport"
  | "other"
  | (string & {})

export type PricingRole = "materials" | "screws" | "labor" | "transport"

export type PriceUnit = "kg" | "meter" | "unit" | "sqm" | "hour" | "pack"

export type OverheadKind = "fixed" | "percent_materials" | "hours"

export interface UnitPriceInput {
  unit: PriceUnit
  pricePerKg?: number
  kgPerMeter?: number
  pricePerUnit?: number
  packPrice?: number
  packQty?: number
}

export interface CostLineInput {
  category: Category
  quantity: number
  unitPrice: number
  pricingRole?: PricingRole
}

export interface OverheadInput {
  kind: OverheadKind
  amount?: number
  percent?: number
  hours?: number
  hourlyRate?: number
}

export interface ProjectCostInput {
  lines: CostLineInput[]
  overheads: OverheadInput[]
  sellingPrice?: number | null
  vatRate: number
  includeVat: boolean
}

export interface ProjectCostResult {
  materials: number
  screws: number
  labor: number
  overheads: number
  subtotal: number
  vatAmount: number
  total: number
  sellingPrice: number | null
  profit: number | null
  marginPercent: number | null
}

function linePricingRole(line: CostLineInput): PricingRole {
  if (line.pricingRole) return line.pricingRole
  if (line.category === "screws") return "screws"
  if (line.category === "labor") return "labor"
  if (line.category === "transport") return "transport"
  return "materials"
}

/**
 * Price of one quantity the user types in.
 * kg items are entered in meters: meters * kgPerMeter * pricePerKg.
 * pack items are entered as a piece count: packPrice / packQty.
 */
export function catalogUnitPrice(item: UnitPriceInput): number {
  switch (item.unit) {
    case "kg":
      return (item.kgPerMeter ?? 0) * (item.pricePerKg ?? 0)
    case "pack": {
      const qty = item.packQty ?? 0
      if (qty <= 0) return 0
      return (item.packPrice ?? 0) / qty
    }
    case "meter":
    case "unit":
    case "sqm":
    case "hour":
      return item.pricePerUnit ?? 0
  }
}

export function lineCost(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

/** Percentage overheads are a share of materials only, not screws, labor, or transport. */
export function overheadAmount(overhead: OverheadInput, materialsCost: number): number {
  switch (overhead.kind) {
    case "fixed":
      return overhead.amount ?? 0
    case "percent_materials":
      return materialsCost * ((overhead.percent ?? 0) / 100)
    case "hours":
      return (overhead.hours ?? 0) * (overhead.hourlyRate ?? 0)
  }
}

/**
 * Project total = materials + screws + labor + overheads.
 * Transport lines are overhead. Catalog prices are before VAT.
 * When includeVat is on, VAT is added to the cost before profit and margin.
 * Selling price is the amount quoted to the customer and is not scaled.
 */
export function projectCost(input: ProjectCostInput): ProjectCostResult {
  let materials = 0
  let screws = 0
  let labor = 0
  let transport = 0

  for (const line of input.lines) {
    const cost = lineCost(line.quantity, line.unitPrice)
    const role = linePricingRole(line)
    if (role === "screws") screws += cost
    else if (role === "labor") labor += cost
    else if (role === "transport") transport += cost
    else materials += cost
  }

  const appliedOverheads = input.overheads.reduce(
    (sum, overhead) => sum + overheadAmount(overhead, materials),
    0,
  )
  const overheads = appliedOverheads + transport
  const subtotal = materials + screws + labor + overheads
  const vatAmount = input.includeVat ? subtotal * (input.vatRate / 100) : 0
  const total = subtotal + vatAmount
  const sellingPrice = input.sellingPrice ?? null
  const profit = sellingPrice == null ? null : sellingPrice - total
  const marginPercent =
    sellingPrice != null && sellingPrice > 0 ? (profit! / sellingPrice) * 100 : null

  return {
    materials,
    screws,
    labor,
    overheads,
    subtotal,
    vatAmount,
    total,
    sellingPrice,
    profit,
    marginPercent,
  }
}
