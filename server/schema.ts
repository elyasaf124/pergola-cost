/** Same statements for the local dev database and for Neon. */
export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS catalog (
    id text PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    price_per_kg double precision,
    kg_per_meter double precision,
    price_per_unit double precision,
    pack_price double precision,
    pack_qty double precision,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY,
    customer_name text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    width_m double precision,
    depth_m double precision,
    height_m double precision,
    notes text NOT NULL,
    status text NOT NULL,
    selling_price double precision,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lines (
    id text PRIMARY KEY,
    project_id text NOT NULL,
    catalog_item_id text,
    name text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    quantity double precision NOT NULL,
    unit_price double precision NOT NULL,
    price_per_kg double precision,
    kg_per_meter double precision,
    pack_price double precision,
    pack_qty double precision,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS global_costs (
    id text PRIMARY KEY,
    name text NOT NULL,
    kind text NOT NULL,
    amount double precision,
    percent double precision,
    hours double precision,
    hourly_rate double precision,
    apply_to_new_projects boolean NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS overheads (
    id text PRIMARY KEY,
    project_id text NOT NULL,
    global_cost_id text,
    name text NOT NULL,
    kind text NOT NULL,
    amount double precision,
    percent double precision,
    hours double precision,
    hourly_rate double precision,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id text PRIMARY KEY,
    vat_rate double precision NOT NULL,
    include_vat boolean NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS lines_project_idx ON lines (project_id)`,
  `CREATE INDEX IF NOT EXISTS overheads_project_idx ON overheads (project_id)`,
] as const
