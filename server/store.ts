import type { Database, Sql } from "./sql.ts"

export interface CatalogGroupRow {
  id: string
  name: string
  sortOrder: number
  pricingRole: string
  createdAt: string
  updatedAt: string
}

export interface BackupData {
  version: 1
  exportedAt: string
  catalogGroups: CatalogGroupRow[]
  catalog: CatalogRow[]
  projects: ProjectRow[]
  lines: LineRow[]
  globalCosts: GlobalCostRow[]
  overheads: OverheadRow[]
  settings: { vatRate: number; includeVat: boolean }
}

export interface CatalogRow {
  id: string
  name: string
  category: string
  unit: string
  pricePerKg?: number
  kgPerMeter?: number
  pricePerUnit?: number
  packPrice?: number
  packQty?: number
  createdAt: string
  updatedAt: string
}

export interface ProjectRow {
  id: string
  customerName: string
  phone: string
  address: string
  widthM: number | null
  depthM: number | null
  heightM: number | null
  notes: string
  status: string
  sellingPrice: number | null
  createdAt: string
  updatedAt: string
}

export interface LineRow {
  id: string
  projectId: string
  catalogItemId: string | null
  name: string
  category: string
  unit: string
  quantity: number
  unitPrice: number
  pricePerKg?: number
  kgPerMeter?: number
  packPrice?: number
  packQty?: number
  createdAt: string
  updatedAt: string
}

export interface GlobalCostRow {
  id: string
  name: string
  kind: string
  amount?: number
  percent?: number
  hours?: number
  hourlyRate?: number
  applyToNewProjects: boolean
  createdAt: string
  updatedAt: string
}

export interface OverheadRow {
  id: string
  projectId: string
  globalCostId: string | null
  name: string
  kind: string
  amount?: number
  percent?: number
  hours?: number
  hourlyRate?: number
  createdAt: string
  updatedAt: string
}

function optional(value: unknown): number | undefined {
  if (value == null || value === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function requiredNumber(value: unknown): number {
  return Number(value)
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function text(value: unknown): string {
  return value == null ? "" : String(value)
}

function nullableText(value: unknown): string | null {
  if (value == null || value === "") return null
  return String(value)
}

function bind(values: unknown[]): unknown[] {
  return values.map((value) => (value === undefined ? null : value))
}

function mapCatalogGroup(row: Record<string, unknown>): CatalogGroupRow {
  return {
    id: text(row.id),
    name: text(row.name),
    sortOrder: requiredNumber(row.sort_order),
    pricingRole: text(row.pricing_role),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

function mapCatalog(row: Record<string, unknown>): CatalogRow {
  return {
    id: text(row.id),
    name: text(row.name),
    category: text(row.category),
    unit: text(row.unit),
    pricePerKg: optional(row.price_per_kg),
    kgPerMeter: optional(row.kg_per_meter),
    pricePerUnit: optional(row.price_per_unit),
    packPrice: optional(row.pack_price),
    packQty: optional(row.pack_qty),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

function mapProject(row: Record<string, unknown>): ProjectRow {
  return {
    id: text(row.id),
    customerName: text(row.customer_name),
    phone: text(row.phone),
    address: text(row.address),
    widthM: nullableNumber(row.width_m),
    depthM: nullableNumber(row.depth_m),
    heightM: nullableNumber(row.height_m),
    notes: text(row.notes),
    status: text(row.status),
    sellingPrice: nullableNumber(row.selling_price),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

function mapLine(row: Record<string, unknown>): LineRow {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    catalogItemId: nullableText(row.catalog_item_id),
    name: text(row.name),
    category: text(row.category),
    unit: text(row.unit),
    quantity: requiredNumber(row.quantity),
    unitPrice: requiredNumber(row.unit_price),
    pricePerKg: optional(row.price_per_kg),
    kgPerMeter: optional(row.kg_per_meter),
    packPrice: optional(row.pack_price),
    packQty: optional(row.pack_qty),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

function mapGlobalCost(row: Record<string, unknown>): GlobalCostRow {
  return {
    id: text(row.id),
    name: text(row.name),
    kind: text(row.kind),
    amount: optional(row.amount),
    percent: optional(row.percent),
    hours: optional(row.hours),
    hourlyRate: optional(row.hourly_rate),
    applyToNewProjects: Boolean(row.apply_to_new_projects),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

function mapOverhead(row: Record<string, unknown>): OverheadRow {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    globalCostId: nullableText(row.global_cost_id),
    name: text(row.name),
    kind: text(row.kind),
    amount: optional(row.amount),
    percent: optional(row.percent),
    hours: optional(row.hours),
    hourlyRate: optional(row.hourly_rate),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  }
}

export async function loadAll(sql: Sql): Promise<BackupData> {
  const [catalogGroups, catalog, projects, lines, globalCosts, overheads, settings] = await Promise.all([
    sql.query("SELECT * FROM catalog_groups ORDER BY sort_order ASC, name ASC"),
    sql.query("SELECT * FROM catalog ORDER BY created_at DESC"),
    sql.query("SELECT * FROM projects ORDER BY updated_at DESC"),
    sql.query("SELECT * FROM lines ORDER BY created_at DESC"),
    sql.query("SELECT * FROM global_costs ORDER BY created_at DESC"),
    sql.query("SELECT * FROM overheads ORDER BY created_at DESC"),
    sql.query("SELECT vat_rate, include_vat FROM settings WHERE id = 'app'"),
  ])
  const settingsRow = settings[0]
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    catalogGroups: catalogGroups.map(mapCatalogGroup),
    catalog: catalog.map(mapCatalog),
    projects: projects.map(mapProject),
    lines: lines.map(mapLine),
    globalCosts: globalCosts.map(mapGlobalCost),
    overheads: overheads.map(mapOverhead),
    settings: {
      vatRate: settingsRow ? requiredNumber(settingsRow.vat_rate) : 18,
      includeVat: settingsRow ? Boolean(settingsRow.include_vat) : false,
    },
  }
}

export async function saveCatalogGroup(sql: Sql, group: CatalogGroupRow): Promise<void> {
  await sql.query(
    `INSERT INTO catalog_groups (id, name, sort_order, pricing_role, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       sort_order = EXCLUDED.sort_order,
       pricing_role = EXCLUDED.pricing_role,
       updated_at = EXCLUDED.updated_at`,
    bind([
      group.id,
      group.name,
      group.sortOrder,
      group.pricingRole,
      group.createdAt,
      group.updatedAt,
    ]),
  )
}

export async function deleteCatalogGroup(sql: Sql, id: string): Promise<void> {
  const rows = await sql.query("SELECT COUNT(*) AS count FROM catalog WHERE category = $1", [id])
  const count = Number(rows[0]?.count ?? 0)
  if (count > 0) {
    throw new Error("לא ניתן למחוק טבלה שיש בה פריטים")
  }
  await sql.query("DELETE FROM catalog_groups WHERE id = $1", [id])
}

export async function saveCatalogItem(sql: Sql, item: CatalogRow): Promise<void> {
  await sql.query(
    `INSERT INTO catalog (
       id, name, category, unit, price_per_kg, kg_per_meter, price_per_unit,
       pack_price, pack_qty, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       unit = EXCLUDED.unit,
       price_per_kg = EXCLUDED.price_per_kg,
       kg_per_meter = EXCLUDED.kg_per_meter,
       price_per_unit = EXCLUDED.price_per_unit,
       pack_price = EXCLUDED.pack_price,
       pack_qty = EXCLUDED.pack_qty,
       updated_at = EXCLUDED.updated_at`,
    bind([
      item.id,
      item.name,
      item.category,
      item.unit,
      item.pricePerKg,
      item.kgPerMeter,
      item.pricePerUnit,
      item.packPrice,
      item.packQty,
      item.createdAt,
      item.updatedAt,
    ]),
  )
}

export async function deleteCatalogItem(sql: Sql, id: string): Promise<void> {
  await sql.query("DELETE FROM catalog WHERE id = $1", [id])
}

export async function saveProject(sql: Sql, project: ProjectRow): Promise<void> {
  await sql.query(
    `INSERT INTO projects (
       id, customer_name, phone, address, width_m, depth_m, height_m, notes,
       status, selling_price, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       customer_name = EXCLUDED.customer_name,
       phone = EXCLUDED.phone,
       address = EXCLUDED.address,
       width_m = EXCLUDED.width_m,
       depth_m = EXCLUDED.depth_m,
       height_m = EXCLUDED.height_m,
       notes = EXCLUDED.notes,
       status = EXCLUDED.status,
       selling_price = EXCLUDED.selling_price,
       updated_at = EXCLUDED.updated_at`,
    bind([
      project.id,
      project.customerName,
      project.phone,
      project.address,
      project.widthM,
      project.depthM,
      project.heightM,
      project.notes,
      project.status,
      project.sellingPrice,
      project.createdAt,
      project.updatedAt,
    ]),
  )
}

export async function deleteProject(sql: Database, id: string): Promise<void> {
  await sql.transaction(async (tx) => {
    await tx.query("DELETE FROM lines WHERE project_id = $1", [id])
    await tx.query("DELETE FROM overheads WHERE project_id = $1", [id])
    await tx.query("DELETE FROM projects WHERE id = $1", [id])
  })
}

export async function saveLine(sql: Sql, line: LineRow): Promise<void> {
  await sql.query(
    `INSERT INTO lines (
       id, project_id, catalog_item_id, name, category, unit, quantity, unit_price,
       price_per_kg, kg_per_meter, pack_price, pack_qty, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       catalog_item_id = EXCLUDED.catalog_item_id,
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       unit = EXCLUDED.unit,
       quantity = EXCLUDED.quantity,
       unit_price = EXCLUDED.unit_price,
       price_per_kg = EXCLUDED.price_per_kg,
       kg_per_meter = EXCLUDED.kg_per_meter,
       pack_price = EXCLUDED.pack_price,
       pack_qty = EXCLUDED.pack_qty,
       updated_at = EXCLUDED.updated_at`,
    bind([
      line.id,
      line.projectId,
      line.catalogItemId,
      line.name,
      line.category,
      line.unit,
      line.quantity,
      line.unitPrice,
      line.pricePerKg,
      line.kgPerMeter,
      line.packPrice,
      line.packQty,
      line.createdAt,
      line.updatedAt,
    ]),
  )
}

export async function deleteLine(sql: Sql, id: string): Promise<void> {
  await sql.query("DELETE FROM lines WHERE id = $1", [id])
}

export async function saveGlobalCost(sql: Sql, cost: GlobalCostRow): Promise<void> {
  await sql.query(
    `INSERT INTO global_costs (
       id, name, kind, amount, percent, hours, hourly_rate, apply_to_new_projects, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       amount = EXCLUDED.amount,
       percent = EXCLUDED.percent,
       hours = EXCLUDED.hours,
       hourly_rate = EXCLUDED.hourly_rate,
       apply_to_new_projects = EXCLUDED.apply_to_new_projects,
       updated_at = EXCLUDED.updated_at`,
    bind([
      cost.id,
      cost.name,
      cost.kind,
      cost.amount,
      cost.percent,
      cost.hours,
      cost.hourlyRate,
      cost.applyToNewProjects,
      cost.createdAt,
      cost.updatedAt,
    ]),
  )
}

export async function deleteGlobalCost(sql: Sql, id: string): Promise<void> {
  await sql.query("DELETE FROM global_costs WHERE id = $1", [id])
}

export async function saveOverhead(sql: Sql, overhead: OverheadRow): Promise<void> {
  await sql.query(
    `INSERT INTO overheads (
       id, project_id, global_cost_id, name, kind, amount, percent, hours, hourly_rate, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       global_cost_id = EXCLUDED.global_cost_id,
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       amount = EXCLUDED.amount,
       percent = EXCLUDED.percent,
       hours = EXCLUDED.hours,
       hourly_rate = EXCLUDED.hourly_rate,
       updated_at = EXCLUDED.updated_at`,
    bind([
      overhead.id,
      overhead.projectId,
      overhead.globalCostId,
      overhead.name,
      overhead.kind,
      overhead.amount,
      overhead.percent,
      overhead.hours,
      overhead.hourlyRate,
      overhead.createdAt,
      overhead.updatedAt,
    ]),
  )
}

export async function deleteOverhead(sql: Sql, id: string): Promise<void> {
  await sql.query("DELETE FROM overheads WHERE id = $1", [id])
}

export async function saveSettings(
  sql: Sql,
  settings: { vatRate: number; includeVat: boolean },
): Promise<void> {
  await sql.query(
    `INSERT INTO settings (id, vat_rate, include_vat)
     VALUES ('app', $1, $2)
     ON CONFLICT (id) DO UPDATE SET
       vat_rate = EXCLUDED.vat_rate,
       include_vat = EXCLUDED.include_vat`,
    [settings.vatRate, settings.includeVat],
  )
}

export async function replaceAll(db: Database, data: BackupData): Promise<void> {
  await db.transaction(async (sql) => {
    await sql.query("DELETE FROM lines")
    await sql.query("DELETE FROM overheads")
    await sql.query("DELETE FROM projects")
    await sql.query("DELETE FROM catalog")
    await sql.query("DELETE FROM catalog_groups")
    await sql.query("DELETE FROM global_costs")
    for (const group of data.catalogGroups) await saveCatalogGroup(sql, group)
    for (const item of data.catalog) await saveCatalogItem(sql, item)
    for (const project of data.projects) await saveProject(sql, project)
    for (const line of data.lines) await saveLine(sql, line)
    for (const cost of data.globalCosts) await saveGlobalCost(sql, cost)
    for (const overhead of data.overheads) await saveOverhead(sql, overhead)
    await saveSettings(sql, data.settings)
  })
}
