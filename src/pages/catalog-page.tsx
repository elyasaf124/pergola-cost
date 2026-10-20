import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Field } from "@/components/field"
import { EmptyState, ErrorState, LoadingState, LockedState } from "@/components/states"
import { Button } from "@/components/ui/button"
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
import { useData } from "@/data/context"
import type { CatalogGroup, CatalogItem, PricingRole } from "@/data/types"
import { parseNumber } from "@/lib/format"
import {
  BUILTIN_GROUP_IDS,
  nextCatalogGroupSortOrder,
  sortCatalogGroups,
} from "@/lib/catalog-groups"
import { PRICING_ROLE_LABEL, UNIT_LABEL, unitPricePreview } from "@/lib/labels"
import { catalogUnitPrice, type Category, type PriceUnit } from "@/lib/pricing"
import { createId, nowIso } from "@/lib/records"

const UNITS: PriceUnit[] = ["kg", "pack", "meter", "unit", "sqm", "hour"]
const PRICING_ROLES: PricingRole[] = ["materials", "screws", "labor", "transport"]

export function CatalogPage() {
  const data = useData()
  const [itemOpen, setItemOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [itemGroupId, setItemGroupId] = useState<string>("profiles")
  const [removing, setRemoving] = useState<CatalogItem | null>(null)
  const [query, setQuery] = useState("")
  const [groupOpen, setGroupOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CatalogGroup | null>(null)
  const [removingGroup, setRemovingGroup] = useState<CatalogGroup | null>(null)

  const needle = query.trim()
  const groups = useMemo(() => sortCatalogGroups(data.catalogGroups), [data.catalogGroups])

  const sections = useMemo(() => {
    return groups
      .map((group) => {
        const items = data.catalog
          .filter((item) => item.category === group.id)
          .filter((item) => (needle ? item.name.includes(needle) : true))
          .sort((a, b) => a.name.localeCompare(b.name, "he"))
        return { group, items }
      })
      .filter((section) => (needle ? section.items.length > 0 : true))
  }, [data.catalog, groups, needle])

  if (data.locked) return <LockedState />
  if (data.loading && !data.ready) return <LoadingState />
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />

  function startCreateItem(groupId: string) {
    setEditing(null)
    setItemGroupId(groupId)
    setItemOpen(true)
  }

  function startCreateGroup() {
    setEditingGroup(null)
    setGroupOpen(true)
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">מחירון</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            כל טבלה היא קטגוריה נפרדת. מחיר שמשתנה כאן לא נוגע בפרויקטים שכבר נפתחו.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-11" onClick={startCreateGroup}>
          <Plus />
          טבלה חדשה
        </Button>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="touch-field bg-card ps-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש בכל הטבלאות"
          aria-label="חיפוש במחירון"
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="אין טבלאות במחירון"
          body="צרו טבלה לפרופילים, ברגים, סנטף או כל קטגוריה אחרת, ואז הוסיפו פריטים."
          action={
            <Button className="h-11" onClick={startCreateGroup}>
              <Plus />
              טבלה ראשונה
            </Button>
          }
        />
      ) : sections.length === 0 ? (
        <EmptyState title="אין תוצאות" body="נסו מילה אחרת בחיפוש." />
      ) : (
        <div className="grid gap-5">
          {sections.map(({ group, items }) => (
            <CatalogGroupTable
              key={group.id}
              group={group}
              items={items}
              catalogGroups={data.catalogGroups}
              canDelete={!BUILTIN_GROUP_IDS.has(group.id) && items.length === 0}
              onAddItem={() => startCreateItem(group.id)}
              onEditGroup={() => {
                setEditingGroup(group)
                setGroupOpen(true)
              }}
              onDeleteGroup={() => setRemovingGroup(group)}
              onEditItem={(item) => {
                setEditing(item)
                setItemGroupId(item.category)
                setItemOpen(true)
              }}
              onRemoveItem={setRemoving}
            />
          ))}
        </div>
      )}

      <CatalogGroupDialog
        open={groupOpen}
        initial={editingGroup}
        sortOrder={editingGroup?.sortOrder ?? nextCatalogGroupSortOrder(data.catalogGroups)}
        onOpenChange={setGroupOpen}
        onSubmit={async (group) => {
          await data.saveCatalogGroup(group)
          toast.success(editingGroup ? "הטבלה עודכנה" : "הטבלה נוצרה")
        }}
      />

      <CatalogFormDialog
        open={itemOpen}
        initial={editing}
        groupId={itemGroupId}
        catalogGroups={data.catalogGroups}
        onOpenChange={setItemOpen}
        onSubmit={async (item) => {
          await data.saveCatalogItem(item)
          toast.success("הפריט נשמר במחירון")
        }}
      />

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null)
        }}
        title="למחוק מהמחירון?"
        description={
          removing
            ? `${removing.name} יימחק מהמחירון. שורות שכבר נכנסו לפרויקטים יישארו עם המחיר שנשמר בהן.`
            : ""
        }
        confirmLabel="מחיקה"
        onConfirm={() => {
          if (!removing) return
          void data
            .deleteCatalogItem(removing.id)
            .then(() => toast.success("הפריט נמחק"))
            .catch(() => toast.error("המחיקה נכשלה"))
          setRemoving(null)
        }}
      />

      <ConfirmDialog
        open={removingGroup != null}
        onOpenChange={(next) => {
          if (!next) setRemovingGroup(null)
        }}
        title="למחוק את הטבלה?"
        description={
          removingGroup
            ? `הטבלה "${removingGroup.name}" תימחק מהמחירון. פריטים קיימים חוסמים מחיקה.`
            : ""
        }
        confirmLabel="מחיקה"
        onConfirm={() => {
          if (!removingGroup) return
          void data
            .deleteCatalogGroup(removingGroup.id)
            .then(() => toast.success("הטבלה נמחקה"))
            .catch((error) => toast.error(error instanceof Error ? error.message : "המחיקה נכשלה"))
          setRemovingGroup(null)
        }}
      />
    </div>
  )
}

function CatalogGroupTable({
  group,
  items,
  catalogGroups,
  canDelete,
  onAddItem,
  onEditGroup,
  onDeleteGroup,
  onEditItem,
  onRemoveItem,
}: {
  group: CatalogGroup
  items: CatalogItem[]
  catalogGroups: CatalogGroup[]
  canDelete: boolean
  onAddItem: () => void
  onEditGroup: () => void
  onDeleteGroup: () => void
  onEditItem: (item: CatalogItem) => void
  onRemoveItem: (item: CatalogItem) => void
}) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-semibold">{group.name}</h2>
          <span className="text-xs text-muted-foreground">{items.length} פריטים</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={`עריכת ${group.name}`} onClick={onEditGroup}>
            <Pencil />
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`מחיקת ${group.name}`}
              onClick={onDeleteGroup}
            >
              <Trash2 />
            </Button>
          ) : null}
          <Button type="button" size="sm" className="h-9" onClick={onAddItem}>
            <Plus />
            פריט
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2.5 text-start font-medium">פריט</th>
              <th className="hidden px-3 py-2.5 text-start font-medium sm:table-cell">יחידה</th>
              <th className="hidden px-3 py-2.5 text-start font-medium lg:table-cell">פירוט</th>
              <th className="px-3 py-2.5 text-start font-medium">מחיר</th>
              <th className="w-20 px-2 py-2.5 text-start font-medium">
                <span className="sr-only">פעולות</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  אין פריטים בטבלה הזו עדיין.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const price = catalogUnitPrice(item)
                return (
                  <tr key={item.id} className="border-b last:border-b-0 even:bg-muted/25 hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="hidden px-3 py-2 whitespace-nowrap sm:table-cell">{UNIT_LABEL[item.unit]}</td>
                    <td className="hidden px-3 py-2 whitespace-nowrap text-muted-foreground lg:table-cell">
                      {priceDetail(item)}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap tabular-nums">
                      {unitPricePreview(item.unit, item.category, price, catalogGroups)}
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`עריכת ${item.name}`}
                          onClick={() => onEditItem(item)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`מחיקת ${item.name}`}
                          onClick={() => onRemoveItem(item)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CatalogGroupDialog({
  open,
  initial,
  sortOrder,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initial: CatalogGroup | null
  sortOrder: number
  onOpenChange: (open: boolean) => void
  onSubmit: (group: CatalogGroup) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [pricingRole, setPricingRole] = useState<PricingRole>("materials")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? "")
    setPricingRole(initial?.pricingRole ?? "materials")
  }, [open, initial])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("צריך שם לטבלה.")
      return
    }
    const now = nowIso()
    setPending(true)
    try {
      await onSubmit({
        id: initial?.id ?? createId(),
        name: name.trim(),
        sortOrder: initial?.sortOrder ?? sortOrder,
        pricingRole,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "עריכת טבלה" : "טבלה חדשה במחירון"}</DialogTitle>
          <DialogDescription>
            שם הטבלה מופיע בפרויקטים. סוג העלות קובע איך הפריט נספר בסיכום (חומרים, ברגים, עבודה או הובלה).
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="שם הטבלה">
            <Input className="touch-field" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="סוג בעלות בפרויקט">
            <Select value={pricingRole} onValueChange={(value) => setPricingRole(value as PricingRole)}>
              <SelectTrigger className="touch-field w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PRICING_ROLE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" className="h-11" disabled={pending}>
              שמירה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function priceDetail(item: CatalogItem): string {
  if (item.unit === "kg") {
    return `${item.pricePerKg ?? 0} ₪ לק״ג · ${item.kgPerMeter ?? 0} ק״ג למטר`
  }
  if (item.unit === "pack") {
    return `${item.packPrice ?? 0} ₪ ל־${item.packQty ?? 0} יחידות`
  }
  return `${item.pricePerUnit ?? 0} ₪ ל${UNIT_LABEL[item.unit]}`
}

function CatalogFormDialog({
  open,
  initial,
  groupId,
  catalogGroups,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initial: CatalogItem | null
  groupId: string
  catalogGroups: CatalogGroup[]
  onOpenChange: (open: boolean) => void
  onSubmit: (item: CatalogItem) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>(groupId)
  const [unit, setUnit] = useState<PriceUnit>("kg")
  const [pricePerKg, setPricePerKg] = useState("25")
  const [kgPerMeter, setKgPerMeter] = useState("2.15")
  const [pricePerUnit, setPricePerUnit] = useState("")
  const [packPrice, setPackPrice] = useState("100")
  const [packQty, setPackQty] = useState("100")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? "")
    setCategory(initial?.category ?? groupId)
    setUnit(initial?.unit ?? "kg")
    setPricePerKg(initial?.pricePerKg == null ? "25" : String(initial.pricePerKg))
    setKgPerMeter(initial?.kgPerMeter == null ? "2.15" : String(initial.kgPerMeter))
    setPricePerUnit(initial?.pricePerUnit == null ? "" : String(initial.pricePerUnit))
    setPackPrice(initial?.packPrice == null ? "100" : String(initial.packPrice))
    setPackQty(initial?.packQty == null ? "100" : String(initial.packQty))
  }, [open, initial, groupId])

  const preview = previewPrice({ unit, pricePerKg, kgPerMeter, pricePerUnit, packPrice, packQty })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("צריך שם לפריט.")
      return
    }
    const built = buildItem({
      initial,
      name: name.trim(),
      category,
      unit,
      pricePerKg,
      kgPerMeter,
      pricePerUnit,
      packPrice,
      packQty,
    })
    if (!built) return
    setPending(true)
    try {
      await onSubmit(built)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה.")
    } finally {
      setPending(false)
    }
  }

  const groups = sortCatalogGroups(catalogGroups)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "עריכת פריט" : "פריט חדש במחירון"}</DialogTitle>
          <DialogDescription>המחיר ליחידה מחושב כאן, לפני שמוסיפים אותו לפרגולה.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="שם">
            <Input className="touch-field" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="טבלה">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="touch-field w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="צורת תמחור">
              <Select value={unit} onValueChange={(value) => setUnit(value as PriceUnit)}>
                <SelectTrigger className="touch-field w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {UNIT_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {unit === "kg" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="מחיר לק״ג (₪)">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={pricePerKg} onChange={(event) => setPricePerKg(event.target.value)} />
              </Field>
              <Field label="ק״ג למטר" hint="כמה שוקל מטר רץ מהפרופיל.">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={kgPerMeter} onChange={(event) => setKgPerMeter(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {unit === "pack" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="מחיר האריזה (₪)">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={packPrice} onChange={(event) => setPackPrice(event.target.value)} />
              </Field>
              <Field label="כמות באריזה" hint="קופסה של 100 ברגים ב־100 ₪ יוצאת 1 ₪ לבורג.">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={packQty} onChange={(event) => setPackQty(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {unit !== "kg" && unit !== "pack" ? (
            <Field label={`מחיר ל${UNIT_LABEL[unit]} (₪)`}>
              <Input className="touch-field tabular-nums" inputMode="decimal" value={pricePerUnit} onChange={(event) => setPricePerUnit(event.target.value)} />
            </Field>
          ) : null}
          <p className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
            {preview == null
              ? "השלימו מחיר כדי לראות את העלות ליחידה."
              : unitPricePreview(unit, category, preview, catalogGroups)}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" className="h-11" disabled={pending}>
              שמירה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function previewPrice(input: {
  unit: PriceUnit
  pricePerKg: string
  kgPerMeter: string
  pricePerUnit: string
  packPrice: string
  packQty: string
}): number | null {
  if (input.unit === "kg") {
    const price = parseNumber(input.pricePerKg)
    const weight = parseNumber(input.kgPerMeter)
    if (price == null || weight == null) return null
    return catalogUnitPrice({ unit: "kg", pricePerKg: price, kgPerMeter: weight })
  }
  if (input.unit === "pack") {
    const price = parseNumber(input.packPrice)
    const qty = parseNumber(input.packQty)
    if (price == null || qty == null || qty <= 0) return null
    return catalogUnitPrice({ unit: "pack", packPrice: price, packQty: qty })
  }
  const price = parseNumber(input.pricePerUnit)
  if (price == null) return null
  return price
}

function buildItem(input: {
  initial: CatalogItem | null
  name: string
  category: Category
  unit: PriceUnit
  pricePerKg: string
  kgPerMeter: string
  pricePerUnit: string
  packPrice: string
  packQty: string
}): CatalogItem | null {
  const now = nowIso()
  const base = {
    id: input.initial?.id ?? createId(),
    name: input.name,
    category: input.category,
    unit: input.unit,
    createdAt: input.initial?.createdAt ?? now,
    updatedAt: now,
  }
  if (input.unit === "kg") {
    const pricePerKg = parseNumber(input.pricePerKg)
    const kgPerMeter = parseNumber(input.kgPerMeter)
    if (pricePerKg == null || pricePerKg < 0 || kgPerMeter == null || kgPerMeter <= 0) {
      toast.error("לפרופיל לפי ק״ג צריך מחיר לק״ג ומשקל למטר.")
      return null
    }
    return { ...base, pricePerKg, kgPerMeter }
  }
  if (input.unit === "pack") {
    const packPrice = parseNumber(input.packPrice)
    const packQty = parseNumber(input.packQty)
    if (packPrice == null || packPrice < 0 || packQty == null || packQty <= 0) {
      toast.error("לאריזה צריך מחיר וכמות גדולה מאפס.")
      return null
    }
    return { ...base, packPrice, packQty }
  }
  const pricePerUnit = parseNumber(input.pricePerUnit)
  if (pricePerUnit == null || pricePerUnit < 0) {
    toast.error("צריך מחיר ליחידת המידה.")
    return null
  }
  return { ...base, pricePerUnit }
}
