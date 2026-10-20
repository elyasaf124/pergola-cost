import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { ProjectFormDialog } from "@/components/project-form"
import { EmptyState, ErrorState, LoadingState, LockedState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useData, type ProjectDraft } from "@/data/context"
import type { Project, ProjectStatus } from "@/data/types"
import { formatIls, formatQty } from "@/lib/format"
import { STATUS_LABEL } from "@/lib/labels"
import { projectCostLines } from "@/lib/catalog-groups"
import { projectCost } from "@/lib/pricing"
import { cn } from "@/lib/utils"

const FILTERS: Array<{ id: "all" | ProjectStatus; label: string }> = [
  { id: "all", label: "הכל" },
  { id: "quote", label: "הצעות" },
  { id: "in_progress", label: "בביצוע" },
  { id: "done", label: "הושלמו" },
]

export function ProjectsPage() {
  const data = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | ProjectStatus>("all")
  const [open, setOpen] = useState(false)

  const projects = useMemo(() => {
    const needle = query.trim()
    return data.projects
      .filter((project) => (status === "all" ? true : project.status === status))
      .filter((project) => {
        if (!needle) return true
        return [project.customerName, project.phone, project.address, project.notes]
          .join(" ")
          .includes(needle)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [data.projects, query, status])

  if (data.locked) return <LockedState />
  if (data.loading && !data.ready) return <LoadingState />
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />

  async function create(draft: ProjectDraft) {
    const project = await data.createProject(draft)
    toast.success("הפרויקט נפתח")
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">פרויקטים</h1>
          <p className="mt-1 text-sm text-muted-foreground">כל פרגולה, עם העלות האמיתית לפני שנותנים מחיר.</p>
        </div>
        <Button className="h-11" onClick={() => setOpen(true)}>
          <Plus />
          חדש
        </Button>
      </div>

      <div className="grid gap-3">
        <Input
          className="touch-field"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש לפי לקוח, טלפון או כתובת"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              size="sm"
              variant={status === filter.id ? "default" : "outline"}
              className="h-9 shrink-0"
              onClick={() => setStatus(filter.id)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {data.projects.length === 0 ? (
        <EmptyState
          title="עדיין אין פרויקטים"
          body="פותחים הצעת מחיר, מוסיפים פרופילים וברגים, ורואים את העלות עד הבורג לפני שסוגרים מחיר ללקוח."
          action={
            <Button className="h-11" onClick={() => setOpen(true)}>
              <Plus />
              פרויקט ראשון
            </Button>
          }
        />
      ) : projects.length === 0 ? (
        <EmptyState title="אין תוצאות" body="נסו שם אחר, או הציגו את כל הסטטוסים." />
      ) : (
        <ul className="grid gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}

      <ProjectFormDialog open={open} onOpenChange={setOpen} onSubmit={create} />
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const data = useData()
  const lines = data.lines.filter((line) => line.projectId === project.id)
  const overheads = data.overheads.filter((overhead) => overhead.projectId === project.id)
  const summary = projectCost({
    lines: projectCostLines(lines, data.catalogGroups),
    overheads,
    sellingPrice: project.sellingPrice,
    vatRate: data.settings.vatRate,
    includeVat: data.settings.includeVat,
  })
  const size = dimensionLabel(project)

  return (
    <Link to={`/projects/${project.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className="transition hover:ring-primary/30">
        <CardContent className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{project.customerName}</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {project.address || project.phone || "בלי כתובת"}
              </p>
            </div>
            <Badge variant={project.status === "done" ? "secondary" : project.status === "quote" ? "outline" : "default"}>
              {STATUS_LABEL[project.status]}
            </Badge>
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs text-muted-foreground">{size || "מידות לא הוזנו"}</p>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">עלות</p>
              <p className={cn("text-lg font-semibold tabular-nums")}>{formatIls(summary.total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function dimensionLabel(project: Project): string {
  const parts: string[] = []
  if (project.widthM != null && project.depthM != null) {
    parts.push(`${formatQty(project.widthM)}×${formatQty(project.depthM)} מ׳`)
  } else if (project.widthM != null) {
    parts.push(`רוחב ${formatQty(project.widthM)} מ׳`)
  } else if (project.depthM != null) {
    parts.push(`עומק ${formatQty(project.depthM)} מ׳`)
  }
  if (project.heightM != null) parts.push(`גובה ${formatQty(project.heightM)} מ׳`)
  return parts.join(" · ")
}
