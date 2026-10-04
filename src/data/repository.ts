import type {
  AppSettings,
  BackupData,
  CatalogItem,
  GlobalCost,
  Project,
  ProjectLine,
  ProjectOverhead,
} from "@/data/types"

export interface Repository {
  readonly mode: "development" | "production"
  loadAll(): Promise<BackupData>
  saveCatalogItem(item: CatalogItem): Promise<void>
  deleteCatalogItem(id: string): Promise<void>
  saveProject(project: Project): Promise<void>
  deleteProject(id: string): Promise<void>
  saveLine(line: ProjectLine): Promise<void>
  deleteLine(id: string): Promise<void>
  saveGlobalCost(cost: GlobalCost): Promise<void>
  deleteGlobalCost(id: string): Promise<void>
  saveOverhead(overhead: ProjectOverhead): Promise<void>
  deleteOverhead(id: string): Promise<void>
  saveSettings(settings: AppSettings): Promise<void>
  replaceAll(data: BackupData): Promise<void>
}
