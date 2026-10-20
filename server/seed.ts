import type { Sql } from "./sql.ts"

const DEFAULT_GROUPS = [
  ["profiles", "פרופילים", 10, "materials"],
  ["screws", "ברגים", 20, "screws"],
  ["sheets", "לוחות", 30, "materials"],
  ["paint", "צבע", 40, "materials"],
  ["labor", "עבודה", 50, "labor"],
  ["transport", "הובלה", 60, "transport"],
  ["other", "אחר", 70, "materials"],
] as const

const CATALOG = [
  ["seed-profile-150x50", "פרופיל אלומיניום 150×50", "profiles", "kg", 25, 2.15, null, null, null],
  ["seed-screw-sheet", "בורג פח 4.2×16", "screws", "pack", null, null, null, 100, 100],
  ["seed-screw-drill", "בורג קידוח 4.8×25", "screws", "pack", null, null, null, 90, 100],
  ["seed-sheet", "פח אלומיניום 0.7 מ״מ", "sheets", "sqm", null, null, 95, null, null],
  ["seed-labor", "שעת עבודה באתר", "labor", "hour", null, null, 180, null, null],
  ["seed-transport", "הובלה לאתר", "transport", "unit", null, null, 300, null, null],
] as const

export async function ensureCatalogGroups(sql: Sql): Promise<void> {
  const now = new Date().toISOString()
  for (const [id, name, sortOrder, pricingRole] of DEFAULT_GROUPS) {
    await sql.query(
      `INSERT INTO catalog_groups (id, name, sort_order, pricing_role, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, sortOrder, pricingRole, now],
    )
  }
  const catalogRows = await sql.query("SELECT DISTINCT category FROM catalog")
  const existing = await sql.query("SELECT id FROM catalog_groups")
  const known = new Set(existing.map((row) => String(row.id)))
  let nextOrder =
    DEFAULT_GROUPS.reduce((max, entry) => Math.max(max, entry[2]), 0) + 10
  for (const row of catalogRows) {
    const category = String(row.category ?? "")
    if (!category || known.has(category)) continue
    await sql.query(
      `INSERT INTO catalog_groups (id, name, sort_order, pricing_role, created_at, updated_at)
       VALUES ($1,$2,$3,'materials',$4,$4)
       ON CONFLICT (id) DO NOTHING`,
      [category, category, nextOrder, now],
    )
    known.add(category)
    nextOrder += 10
  }
}

export async function ensureSettings(sql: Sql): Promise<void> {
  await sql.query(
    `INSERT INTO settings (id, vat_rate, include_vat)
     VALUES ('app', 18, false)
     ON CONFLICT (id) DO NOTHING`,
  )
}

/** Starter catalog and the 5% waste cost, only when every business table is empty. */
export async function seedIfEmpty(sql: Sql): Promise<void> {
  const counts = await sql.query(
    `SELECT
       (SELECT COUNT(*) FROM catalog) AS catalog,
       (SELECT COUNT(*) FROM projects) AS projects,
       (SELECT COUNT(*) FROM lines) AS lines,
       (SELECT COUNT(*) FROM global_costs) AS global_costs,
       (SELECT COUNT(*) FROM overheads) AS overheads`,
  )
  const row = counts[0] ?? {}
  const total = ["catalog", "projects", "lines", "global_costs", "overheads"].reduce(
    (sum, key) => sum + Number(row[key] ?? 0),
    0,
  )
  if (total > 0) return

  const now = new Date().toISOString()
  for (const item of CATALOG) {
    await sql.query(
      `INSERT INTO catalog (
         id, name, category, unit, price_per_kg, kg_per_meter, price_per_unit,
         pack_price, pack_qty, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [...item, now, now],
    )
  }
  await sql.query(
    `INSERT INTO global_costs (
       id, name, kind, amount, percent, hours, hourly_rate, apply_to_new_projects, created_at, updated_at
     ) VALUES ($1,$2,'percent_materials',NULL,5,NULL,NULL,true,$3,$3)
     ON CONFLICT (id) DO NOTHING`,
    ["seed-waste", "פחת חומר", now],
  )
}
