import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Field } from "@/components/field"
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
import { useData } from "@/data/context"
import type { CatalogItem } from "@/data/types"
import { parseNumber } from "@/lib/format"
import { CATEGORIES, CATEGORY_LABEL, UNIT_LABEL, unitPricePreview } from "@/lib/labels"
import { catalogUnitPrice, type Category, type PriceUnit } from "@/lib/pricing"
import { createId, nowIso } from "@/lib/records"

const UNITS: PriceUnit[] = ["kg", "pack", "meter", "unit", "sqm", "hour"]

export function CatalogPage() {
  const data = useData()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [removing, setRemoving] = useState<CatalogItem | null>(null)

  const groups = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        items: data.catalog
          .filter((item) => item.category === category)
          .sort((a, b) => a.name.localeCompare(b.name, "he")),
      })).filter((group) => group.items.length > 0),
    [data.catalog],
  )

  if (data.locked) return <LockedState />
  if (data.loading && !data.ready) return <LoadingState />
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />

  function startCreate() {
    setEditing(null)
    setOpen(true)
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">מחירון</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            מחיר שמשתנה כאן לא נוגע בפרויקטים שכבר נפתחו. כל שורה שומרת את המחיר שלה.
          </p>
        </div>
        <Button className="h-11" onClick={startCreate}>
          <Plus />
          פריט
        </Button>
      </div>

      {data.catalog.length === 0 ? (
        <EmptyState
          title="המחירון ריק"
          body="הוסיפו פרופיל, בורג, לוח או שעת עבודה. אחר כך אפשר למשוך אותם לכל פרגולה."
          action={
            <Button className="h-11" onClick={startCreate}>
              <Plus />
              פריט ראשון
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => (
            <section key={group.category} className="grid gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{CATEGORY_LABEL[group.category]}</h2>
              <ul className="grid gap-2">
                {group.items.map((item) => {
                  const price = catalogUnitPrice(item)
                  return (
                    <li key={item.id}>
                      <Card>
                        <CardContent className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{item.name}</h3>
                              <Badge variant="outline">{UNIT_LABEL[item.unit]}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{priceDetail(item)}</p>
                            <p className="mt-2 text-base font-semibold tabular-nums text-primary">
                              {unitPricePreview(item.unit, item.category, price)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`עריכת ${item.name}`}
                              onClick={() => {
                                setEditing(item)
                                setOpen(true)
                              }}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`מחיקת ${item.name}`}
                              onClick={() => setRemoving(item)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <CatalogFormDialog
        open={open}
        initial={editing}
        onOpenChange={setOpen}
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
    </div>
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
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initial: CatalogItem | null
  onOpenChange: (open: boolean) => void
  onSubmit: (item: CatalogItem) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<Category>("profiles")
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
    setCategory(initial?.category ?? "profiles")
    setUnit(initial?.unit ?? "kg")
    setPricePerKg(initial?.pricePerKg == null ? "25" : String(initial.pricePerKg))
    setKgPerMeter(initial?.kgPerMeter == null ? "2.15" : String(initial.kgPerMeter))
    setPricePerUnit(initial?.pricePerUnit == null ? "" : String(initial.pricePerUnit))
    setPackPrice(initial?.packPrice == null ? "100" : String(initial.packPrice))
    setPackQty(initial?.packQty == null ? "100" : String(initial.packQty))
  }, [open, initial])

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
            <Field label="קטגוריה">
              <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
                <SelectTrigger className="touch-field w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CATEGORY_LABEL[value]}
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
            {preview == null ? "השלימו מחיר כדי לראות את העלות ליחידה." : unitPricePreview(unit, category, preview)}
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
