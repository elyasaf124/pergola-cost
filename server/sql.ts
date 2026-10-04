export interface Sql {
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>
}

export interface Database extends Sql {
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>
}
