export function formatIls(value: number): string {
  if (!Number.isFinite(value)) return "— ₪"
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  const fraction = Math.abs(rounded - Math.trunc(rounded))
  const digits = fraction < 0.001 ? 0 : 2
  const text = new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(rounded)
  return `${text} ₪`
}

export function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const text = new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(Math.round(value * 10) / 10) ? 0 : 1,
  }).format(Math.round(value * 10) / 10)
  return `${text}%`
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 3 }).format(value)
}

export function parseNumber(value: string): number | null {
  const normalized = value.replace(/,/g, ".").trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}
