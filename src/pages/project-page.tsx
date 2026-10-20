import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Field } from "@/components/field"
import { ProjectFormDialog } from "@/components/project-form"
import { EmptyState, ErrorState, LoadingState, LockedState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useData, type ProjectDraft } from "@/data/context"
import type { CatalogGroup, CatalogItem, GlobalCost, Project, ProjectLine, ProjectOverhead } from "@/data/types"
import { formatIls, formatPercent, formatQty, parseNumber } from "@/lib/format"
import {
  OVERHEAD_LABEL,
  STATUS_LABEL,
  UNIT_LABEL,
  lineFormula,
  perUnitPhrase,
  quantityNoun,
  unitPricePreview,
} from "@/lib/labels"
import {
  categoryLabel,
  pricingRoleForCategory,
  projectCostLines,
  sortCatalogGroups,
} from "@/lib/catalog-groups"
import {
  catalogUnitPrice,
  lineCost,
  overheadAmount,
  projectCost,
  type OverheadKind,
  type PriceUnit,
} from "@/lib/pricing"
import { createId, freeformLine, lineFromCatalog, nowIso, overheadFromGlobal } from "@/lib/records"
import { cn } from "@/lib/utils"

const FREE_UNITS: PriceUnit[] = ["unit", "meter", "sqm", "hour"]
const KINDS: OverheadKind[] = ["fixed", "percent_materials", "hours"]

export function ProjectPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const data = useData()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [freeOpen, setFreeOpen] = useState(false)
  const [lineEditing, setLineEditing] = useState<ProjectLine | null>(null)
  const [lineDeleting, setLineDeleting] = useState<ProjectLine | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [overheadEditing, setOverheadEditing] = useState<ProjectOverhead | "new" | null>(null)
  const [overheadDeleting, setOverheadDeleting] = useState<ProjectOverhead | null>(null)
  const [sellingDraft, setSellingDraft] = useState<string | null>(null)

  const project = data.projects.find((item) => item.id === id) ?? null
  const lines = useMemo(
    () => data.lines.filter((line) => line.projectId === id),
    [data.lines, id],
  )
  const overheads = useMemo(
    () => data.overheads.filter((overhead) => overhead.projectId === id),
    [data.overheads, id],
  )
  const summary = projectCost({
    lines: projectCostLines(lines, data.catalogGroups),
    overheads,
    sellingPrice: project?.sellingPrice,
    vatRate: data.settings.vatRate,
    includeVat: data.settings.includeVat,
  })

  if (data.locked) return <LockedState />
  if (data.loading && !data.ready) return <LoadingState />
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />
  if (!project) {
    return (
      <EmptyState
        title="הפרויקט לא נמצא"
        body="ייתכן שהפרויקט נמחק, או שהקישור לא שייך למסד הפעיל."
        action={
          <Button asChild className="h-11">
            <Link to="/">חזרה לפרויקטים</Link>
          </Button>
        }
      />
    )
  }

  const groups = sortCatalogGroups(data.catalogGroups)
    .map((group) => ({
      group,
      lines: lines.filter((line) => line.category === group.id),
    }))
    .filter((entry) => entry.lines.length > 0)

  async function saveDraft(draft: ProjectDraft) {
    await data.saveProject({ ...project!, ...draft, id: project!.id, createdAt: project!.createdAt, updatedAt: project!.updatedAt })
    toast.success("הפרויקט עודכן")
  }

  async function commitSellingPrice() {
    const raw = (sellingDraft ?? (project!.sellingPrice == null ? "" : String(project!.sellingPrice))).trim()
    const sellingPrice = raw ? parseNumber(raw) : null
    if (raw && (sellingPrice == null || sellingPrice < 0)) {
      toast.error("מחיר המכירה צריך להיות מספר חיובי.")
      return
    }
    setSellingDraft(null)
    if (sellingPrice === project!.sellingPrice) return
    await data.saveProject({ ...project!, sellingPrice })
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowRight className="size-4" />
            פרויקטים
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{project.customerName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[project.phone, project.address, dimensionLabel(project)].filter(Boolean).join(" · ") || "בלי פרטי קשר"}
          </p>
        </div>
        <Badge variant={project.status === "quote" ? "outline" : "default"}>{STATUS_LABEL[project.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10" onClick={() => setEditOpen(true)}>
          <Pencil />
          פרטי לקוח
        </Button>
        <Button variant="ghost" className="h-10 text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 />
          מחיקה
        </Button>
      </div>

      <SummaryCard
        summary={summary}
        includeVat={data.settings.includeVat}
        vatRate={data.settings.vatRate}
        sellingValue={sellingDraft ?? (project.sellingPrice == null ? "" : String(project.sellingPrice))}
        onSellingChange={setSellingDraft}
        onSellingBlur={() => {
          void commitSellingPrice().catch(() => toast.error("שמירת מחיר המכירה נכשלה"))
        }}
      />

      <QuickAdd
        catalog={data.catalog}
        catalogGroups={data.catalogGroups}
        onAdd={async (item, quantity) => {
          const line = lineFromCatalog(project.id, item, quantity)
          await data.saveLine(line)
          toast.success(`${item.name}: ${formatIls(lineCost(quantity, line.unitPrice))}`)
        }}
        onFreeform={() => setFreeOpen(true)}
      />

      {lines.length === 0 ? (
        <EmptyState
          title="עדיין אין שורות"
          body="חפשו פריט במחירון והקלידו כמות: מטרים לפרופיל, מספר ברגים לקופסה. אפשר גם להוסיף הוצאה חופשית."
        />
      ) : (
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.group.id} className="grid gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{group.group.name}</h2>
              <ul className="grid gap-2">
                {group.lines.map((line) => (
                  <li key={line.id}>
                    <Card>
                      <CardContent className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium">{line.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{lineFormula(line, data.catalogGroups)}</p>
                          <p className="mt-1 text-base font-semibold tabular-nums">{formatIls(lineCost(line.quantity, line.unitPrice))}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" aria-label={`עריכת ${line.name}`} onClick={() => setLineEditing(line)}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`מחיקת ${line.name}`} onClick={() => setLineDeleting(line)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">תקורה בפרויקט</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => setLibraryOpen(true)}>
              מהרשימה
            </Button>
            <Button size="sm" className="h-9" onClick={() => setOverheadEditing("new")}>
              <Plus />
              חדשה
            </Button>
          </div>
        </div>
        {overheads.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            אין תקורה בפרויקט הזה. פחת או הובלה קבועה שמסומנים «לפרויקטים חדשים» נכנסים אוטומטית רק בפתיחה.
          </p>
        ) : (
          <ul className="grid gap-2">
            {overheads.map((overhead) => (
              <li key={overhead.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{overhead.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{OVERHEAD_LABEL[overhead.kind]}</p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {formatIls(overheadAmount(overhead, summary.materials))}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`עריכת ${overhead.name}`} onClick={() => setOverheadEditing(overhead)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`הסרת ${overhead.name}`} onClick={() => setOverheadDeleting(overhead)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {project.notes ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-6">{project.notes}</p>
      ) : null}

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} initial={project} onSubmit={saveDraft} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="למחוק את הפרויקט?"
        description="השורות והתקורה של הפרגולה הזו יימחקו. המחירון לא נפגע."
        confirmLabel="מחיקת פרויקט"
        onConfirm={() => {
          void data
            .deleteProject(project.id)
            .then(() => {
              toast.success("הפרויקט נמחק")
              navigate("/")
            })
            .catch(() => toast.error("המחיקה נכשלה"))
        }}
      />
      <FreeformDialog
        open={freeOpen}
        catalogGroups={data.catalogGroups}
        onOpenChange={setFreeOpen}
        onSubmit={async (line) => {
          await data.saveLine({ ...line, projectId: project.id })
          toast.success("ההוצאה נוספה")
        }}
      />
      <LineDialog
        line={lineEditing}
        catalogGroups={data.catalogGroups}
        onOpenChange={(open) => {
          if (!open) setLineEditing(null)
        }}
        onSubmit={async (line) => {
          await data.saveLine(line)
          toast.success("השורה עודכנה")
        }}
      />
      <ConfirmDialog
        open={lineDeleting != null}
        onOpenChange={(open) => {
          if (!open) setLineDeleting(null)
        }}
        title="להסיר את השורה?"
        description={lineDeleting ? lineDeleting.name : ""}
        confirmLabel="הסרה"
        onConfirm={() => {
          if (!lineDeleting) return
          void data.deleteLine(lineDeleting.id).catch(() => toast.error("ההסרה נכשלה"))
          setLineDeleting(null)
        }}
      />
      <LibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        costs={data.globalCosts}
        appliedIds={overheads.map((overhead) => overhead.globalCostId).filter((value): value is string => Boolean(value))}
        onPick={async (cost) => {
          await data.saveOverhead(overheadFromGlobal(project.id, cost))
          toast.success(`${cost.name} נוסף לפרויקט`)
          setLibraryOpen(false)
        }}
      />
      <OverheadDialog
        open={overheadEditing != null}
        initial={overheadEditing === "new" ? null : overheadEditing}
        onOpenChange={(open) => {
          if (!open) setOverheadEditing(null)
        }}
        onSubmit={async (overhead) => {
          await data.saveOverhead({ ...overhead, projectId: project.id })
          toast.success("התקורה נשמרה")
        }}
      />
      <ConfirmDialog
        open={overheadDeleting != null}
        onOpenChange={(open) => {
          if (!open) setOverheadDeleting(null)
        }}
        title="להסיר את התקורה מהפרויקט?"
        description="הרשימה הגלובלית לא משתנה. אפשר להוסיף שוב אחר כך."
        confirmLabel="הסרה"
        onConfirm={() => {
          if (!overheadDeleting) return
          void data.deleteOverhead(overheadDeleting.id).catch(() => toast.error("ההסרה נכשלה"))
          setOverheadDeleting(null)
        }}
      />
    </div>
  )
}

function SummaryCard({
  summary,
  includeVat,
  vatRate,
  sellingValue,
  onSellingChange,
  onSellingBlur,
}: {
  summary: ReturnType<typeof projectCost>
  includeVat: boolean
  vatRate: number
  sellingValue: string
  onSellingChange: (value: string) => void
  onSellingBlur: () => void
}) {
  const rows = [
    ["חומרים", summary.materials],
    ["ברגים", summary.screws],
    ["עבודה", summary.labor],
    ["תקורה", summary.overheads],
  ] as const
  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatIls(value)}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">עלות כוללת</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatIls(summary.total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {includeVat ? `כולל מע״מ ${vatRate}%` : `לפני מע״מ · ${vatRate}% מוגדר בהגדרות`}
            </p>
          </div>
          <Field label="מחיר מכירה (₪)">
            <Input
              className="touch-field tabular-nums"
              inputMode="decimal"
              value={sellingValue}
              placeholder="כמה מבקשים מהלקוח"
              onChange={(event) => onSellingChange(event.target.value)}
              onBlur={onSellingBlur}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur()
              }}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted px-3 py-3">
          <div>
            <p className="text-xs text-muted-foreground">רווח</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", summary.profit != null && summary.profit < 0 && "text-destructive")}>
              {summary.profit == null ? "—" : formatIls(summary.profit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">מרווח</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatPercent(summary.marginPercent)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickAdd({
  catalog,
  catalogGroups,
  onAdd,
  onFreeform,
}: {
  catalog: CatalogItem[]
  catalogGroups: CatalogGroup[]
  onAdd: (item: CatalogItem, quantity: number) => Promise<void>
  onFreeform: () => void
}) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState("")
  const [openList, setOpenList] = useState(false)
  const [pending, setPending] = useState(false)
  const selected = catalog.find((item) => item.id === selectedId) ?? null
  const matches = catalog
    .filter((item) => item.name.includes(query.trim()))
    .sort((a, b) => a.name.localeCompare(b.name, "he"))
    .slice(0, 8)

  async function add() {
    if (!selected) {
      toast.error("בחרו פריט מהמחירון.")
      return
    }
    const qty = parseNumber(quantity)
    if (qty == null || qty <= 0) {
      toast.error("הכמות צריכה להיות גדולה מאפס.")
      return
    }
    setPending(true)
    try {
      await onAdd(selected, qty)
      setQuantity("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הוספת השורה נכשלה")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">הוספה מהמחירון</h2>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onFreeform}>
            הוצאה חופשית
          </Button>
        </div>
        <div className="relative">
          <Input
            className="touch-field"
            value={selected && !openList ? selected.name : query}
            placeholder="חיפוש פרופיל, בורג, לוח…"
            onFocus={() => {
              setOpenList(true)
              if (selected) setQuery(selected.name)
            }}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedId(null)
              setOpenList(true)
            }}
            onBlur={() => setOpenList(false)}
          />
          {openList && matches.length > 0 ? (
            <ul className="mt-1 max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-md">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-start text-sm hover:bg-muted"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setSelectedId(item.id)
                      setQuery(item.name)
                      setOpenList(false)
                    }}
                  >
                    <span>
                      {item.name}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {categoryLabel(item.category, catalogGroups)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {unitPricePreview(item.unit, item.category, catalogUnitPrice(item), catalogGroups)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {selected ? (
          <p className="text-sm text-muted-foreground">
            {unitPricePreview(selected.unit, selected.category, catalogUnitPrice(selected), catalogGroups)}
            {selected.unit === "kg" ? " · מקלידים מטרים" : null}
            {selected.unit === "pack" || pricingRoleForCategory(selected.category, catalogGroups) === "screws"
              ? " · מקלידים כמה יחידות יצאו"
              : null}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Input
            className="touch-field tabular-nums"
            inputMode="decimal"
            value={quantity}
            placeholder={
              selected ? `כמות (${quantityNoun(selected.unit, selected.category, catalogGroups)})` : "כמות"
            }
            onChange={(event) => setQuantity(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void add()
              }
            }}
          />
          <Button className="h-11 shrink-0" disabled={pending} onClick={() => void add()}>
            הוספה
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FreeformDialog({
  open,
  catalogGroups,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  catalogGroups: CatalogGroup[]
  onOpenChange: (open: boolean) => void
  onSubmit: (line: ProjectLine) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>("other")
  const [unit, setUnit] = useState<PriceUnit>("unit")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const qty = parseNumber(quantity)
    const price = parseNumber(unitPrice)
    if (!name.trim() || qty == null || qty <= 0 || price == null || price < 0) {
      toast.error("צריך שם, כמות ומחיר ליחידה.")
      return
    }
    setPending(true)
    try {
      await onSubmit(freeformLine({ projectId: "", name: name.trim(), category, unit, quantity: qty, unitPrice: price }))
      setName("")
      setUnitPrice("")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>הוצאה חופשית</DialogTitle>
          <DialogDescription>סכום שלא נמצא במחירון. המחיר נשמר בשורה הזו בלבד.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="שם">
            <Input className="touch-field" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="טבלה במחירון">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="touch-field w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortCatalogGroups(catalogGroups).map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="יחידה">
              <Select value={unit} onValueChange={(value) => setUnit(value as PriceUnit)}>
                <SelectTrigger className="touch-field w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREE_UNITS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {UNIT_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="כמות">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
            <Field label={`מחיר ${perUnitPhrase(unit, category, catalogGroups)} (₪)`}>
              <Input className="touch-field tabular-nums" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" className="h-11" disabled={pending}>
              הוספה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LineDialog({
  line,
  catalogGroups,
  onOpenChange,
  onSubmit,
}: {
  line: ProjectLine | null
  catalogGroups: CatalogGroup[]
  onOpenChange: (open: boolean) => void
  onSubmit: (line: ProjectLine) => Promise<void>
}) {
  const [name, setName] = useState(line?.name ?? "")
  const [quantity, setQuantity] = useState(line ? String(line.quantity) : "")
  const [unitPrice, setUnitPrice] = useState(line ? String(line.unitPrice) : "")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!line) return
    setName(line.name)
    setQuantity(String(line.quantity))
    setUnitPrice(String(line.unitPrice))
  }, [line])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!line) return
    const qty = parseNumber(quantity)
    const price = parseNumber(unitPrice)
    if (!name.trim() || qty == null || qty <= 0 || price == null || price < 0) {
      toast.error("צריך שם, כמות ומחיר ליחידה.")
      return
    }
    setPending(true)
    try {
      await onSubmit({ ...line, name: name.trim(), quantity: qty, unitPrice: price, updatedAt: nowIso() })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={line != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת שורה</DialogTitle>
          <DialogDescription>השינוי נשאר בשורה הזו ולא חוזר למחירון.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="שם">
            <Input className="touch-field" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field
            label={
              line ? `כמות (${quantityNoun(line.unit, line.category, catalogGroups)})` : "כמות"
            }
          >
            <Input className="touch-field tabular-nums" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </Field>
          <Field label="מחיר ליחידת כמות (₪)">
            <Input className="touch-field tabular-nums" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" className="h-11" disabled={pending}>
              שמירה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LibraryDialog({
  open,
  onOpenChange,
  costs,
  appliedIds,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  costs: GlobalCost[]
  appliedIds: string[]
  onPick: (cost: GlobalCost) => Promise<void>
}) {
  const applied = new Set(appliedIds)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>תקורה מהרשימה</DialogTitle>
          <DialogDescription>נוסף עותק עם הסכום הנוכחי. שינוי עתידי ברשימה לא ישנה את הפרויקט.</DialogDescription>
        </DialogHeader>
        {costs.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין עדיין עלויות ברשימה הגלובלית.</p>
        ) : (
          <ul className="grid max-h-80 gap-2 overflow-auto">
            {costs.map((cost) => (
              <li key={cost.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between py-3"
                  disabled={applied.has(cost.id)}
                  onClick={() => void onPick(cost)}
                >
                  <span>{cost.name}</span>
                  <span className="text-xs text-muted-foreground">{applied.has(cost.id) ? "כבר בפרויקט" : OVERHEAD_LABEL[cost.kind]}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OverheadDialog({
  open,
  initial,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initial: ProjectOverhead | null
  onOpenChange: (open: boolean) => void
  onSubmit: (overhead: ProjectOverhead) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<OverheadKind>("fixed")
  const [amount, setAmount] = useState("")
  const [percent, setPercent] = useState("")
  const [hours, setHours] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? "")
    setKind(initial?.kind ?? "fixed")
    setAmount(initial?.amount == null ? "" : String(initial.amount))
    setPercent(initial?.percent == null ? "" : String(initial.percent))
    setHours(initial?.hours == null ? "" : String(initial.hours))
    setHourlyRate(initial?.hourlyRate == null ? "" : String(initial.hourlyRate))
  }, [open, initial])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("צריך שם.")
      return
    }
    const now = nowIso()
    const base: ProjectOverhead = {
      id: initial?.id ?? createId(),
      projectId: initial?.projectId ?? "",
      globalCostId: initial?.globalCostId ?? null,
      name: name.trim(),
      kind,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    if (kind === "fixed") {
      const value = parseNumber(amount)
      if (value == null || value < 0) {
        toast.error("צריך סכום.")
        return
      }
      base.amount = value
    } else if (kind === "percent_materials") {
      const value = parseNumber(percent)
      if (value == null || value < 0) {
        toast.error("צריך אחוז.")
        return
      }
      base.percent = value
    } else {
      const hourValue = parseNumber(hours)
      const rate = parseNumber(hourlyRate)
      if (hourValue == null || rate == null || hourValue < 0 || rate < 0) {
        toast.error("צריך שעות ותעריף.")
        return
      }
      base.hours = hourValue
      base.hourlyRate = rate
    }
    setPending(true)
    try {
      await onSubmit(base)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "עריכת תקורה" : "תקורה לפרויקט"}</DialogTitle>
          <DialogDescription>הסכום נשמר רק בפרגולה הזו.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="שם">
            <Input className="touch-field" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="סוג">
            <Select value={kind} onValueChange={(value) => setKind(value as OverheadKind)}>
              <SelectTrigger className="touch-field w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {OVERHEAD_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {kind === "fixed" ? (
            <Field label="סכום (₪)">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
          ) : null}
          {kind === "percent_materials" ? (
            <Field label="אחוז מהחומרים">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={percent} onChange={(event) => setPercent(event.target.value)} />
            </Field>
          ) : null}
          {kind === "hours" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="שעות">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} />
              </Field>
              <Field label="₪ לשעה">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" className="h-11" disabled={pending}>
              שמירה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function dimensionLabel(project: Project): string {
  const parts: string[] = []
  if (project.widthM != null && project.depthM != null) {
    parts.push(`${formatQty(project.widthM)}×${formatQty(project.depthM)} מ׳`)
  }
  if (project.heightM != null) parts.push(`גובה ${formatQty(project.heightM)} מ׳`)
  return parts.join(" · ")
}
