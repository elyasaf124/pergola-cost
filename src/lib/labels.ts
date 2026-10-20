import type { CatalogGroup } from "@/data/types"
import type { Category, OverheadKind, PriceUnit, PricingRole } from "@/lib/pricing"
import { pricingRoleForCategory } from "@/lib/catalog-groups"
import type { ProjectLine } from "@/data/types"
import { formatIls, formatQty } from "@/lib/format"

export const CATEGORIES: Category[] = [
  "profiles",
  "sheets",
  "paint",
  "screws",
  "labor",
  "transport",
  "other",
]

export const CATEGORY_LABEL: Record<Category, string> = {
  profiles: "פרופילים",
  screws: "ברגים",
  sheets: "לוחות",
  paint: "צבע",
  labor: "עבודה",
  transport: "הובלה",
  other: "אחר",
}

export const STATUS_LABEL = {
  quote: "הצעת מחיר",
  in_progress: "בביצוע",
  done: "הושלם",
} as const

export const UNIT_LABEL: Record<PriceUnit, string> = {
  kg: "ק״ג",
  meter: "מטר",
  unit: "יחידה",
  sqm: "מ״ר",
  hour: "שעה",
  pack: "אריזה",
}

export const OVERHEAD_LABEL: Record<OverheadKind, string> = {
  fixed: "סכום קבוע לפרויקט",
  percent_materials: "אחוז מעלות החומרים",
  hours: "שעות כפול תעריף",
}

export function quantityNoun(
  unit: PriceUnit,
  category: Category,
  groups: CatalogGroup[] = [],
): string {
  if (unit === "kg" || unit === "meter") return "מטר"
  if (unit === "sqm") return "מ״ר"
  if (unit === "hour") return "שעות"
  if (pricingRoleForCategory(category, groups) === "screws" || unit === "pack") return "יחידות"
  return "יחידות"
}

export function perUnitPhrase(
  unit: PriceUnit,
  category: Category,
  groups: CatalogGroup[] = [],
): string {
  const role = pricingRoleForCategory(category, groups)
  if (role === "screws" || unit === "pack") return "לבורג"
  if (unit === "kg" || unit === "meter") return "למטר"
  if (unit === "sqm") return "למ״ר"
  if (unit === "hour") return "לשעה"
  if (role === "transport") return "להובלה"
  return "ליחידה"
}

export function unitPricePreview(
  unit: PriceUnit,
  category: Category,
  price: number,
  groups: CatalogGroup[] = [],
): string {
  return `${formatIls(price)} ${perUnitPhrase(unit, category, groups)}`
}

export function lineFormula(line: ProjectLine, groups: CatalogGroup[] = []): string {
  if (line.unit === "kg" && line.kgPerMeter != null && line.pricePerKg != null) {
    return `${formatQty(line.quantity)} מ׳ × ${formatQty(line.kgPerMeter)} ק״ג/מ׳ × ${formatIls(line.pricePerKg)}`
  }
  const noun = quantityNoun(line.unit, line.category, groups)
  const each = perUnitPhrase(line.unit, line.category, groups)
  return `${formatQty(line.quantity)} ${noun} × ${formatIls(line.unitPrice)} ${each}`
}

export const PRICING_ROLE_LABEL: Record<PricingRole, string> = {
  materials: "חומרים (פרופילים, לוחות וכו׳)",
  screws: "ברגים",
  labor: "עבודה",
  transport: "הובלה",
}
