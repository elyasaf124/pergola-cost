import { useEffect, useState, type FormEvent } from "react"
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
import { Switch } from "@/components/ui/switch"
import { useData } from "@/data/context"
import type { GlobalCost } from "@/data/types"
import { formatIls, parseNumber } from "@/lib/format"
import { OVERHEAD_LABEL } from "@/lib/labels"
import { type OverheadKind } from "@/lib/pricing"
import { createId, nowIso } from "@/lib/records"

const KINDS: OverheadKind[] = ["fixed", "percent_materials", "hours"]

export function GlobalCostsPage() {
  const data = useData()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GlobalCost | null>(null)
  const [removing, setRemoving] = useState<GlobalCost | null>(null)

  if (data.locked) return <LockedState />
  if (data.loading && !data.ready) return <LoadingState />
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />

  const costs = [...data.globalCosts].sort((a, b) => a.name.localeCompare(b.name, "he"))

  return (
    <div className="grid gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">תקורה</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            הובלה קבועה, פחת באחוזים, או שעות. מה שמסומן יתווסף לכל פרויקט חדש, ואפשר להוריד אותו אחר כך מפרויקט בודד.
          </p>
        </div>
        <Button
          className="h-11"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus />
          עלות
        </Button>
      </div>

      {costs.length === 0 ? (
        <EmptyState
          title="אין עלויות קבועות"
          body="למשל פחת של 5% על החומר, או הובלה של 300 ₪ שנכנסת לכל הצעה חדשה."
          action={
            <Button
              className="h-11"
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              <Plus />
              עלות ראשונה
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-2">
          {costs.map((cost) => (
            <li key={cost.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{cost.name}</h2>
                      {cost.applyToNewProjects ? <Badge>לפרויקטים חדשים</Badge> : <Badge variant="outline">ידני</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{OVERHEAD_LABEL[cost.kind]}</p>
                    <p className="mt-2 font-semibold tabular-nums">{describeCost(cost)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`עריכת ${cost.name}`}
                      onClick={() => {
                        setEditing(cost)
                        setOpen(true)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`מחיקת ${cost.name}`} onClick={() => setRemoving(cost)}>
                      <Trash2 />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CostFormDialog
        open={open}
        initial={editing}
        onOpenChange={setOpen}
        onSubmit={async (cost) => {
          await data.saveGlobalCost(cost)
          toast.success("העלות נשמרה")
        }}
      />
      <ConfirmDialog
        open={removing != null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null)
        }}
        title="למחוק עלות קבועה?"
        description={
          removing
            ? `${removing.name} לא תתווסף לפרויקטים חדשים. פרויקטים שכבר קיבלו אותה לא משתנים.`
            : ""
        }
        confirmLabel="מחיקה"
        onConfirm={() => {
          if (!removing) return
          void data
            .deleteGlobalCost(removing.id)
            .then(() => toast.success("העלות נמחקה"))
            .catch(() => toast.error("המחיקה נכשלה"))
          setRemoving(null)
        }}
      />
    </div>
  )
}

function describeCost(cost: GlobalCost): string {
  if (cost.kind === "fixed") return formatIls(cost.amount ?? 0)
  if (cost.kind === "percent_materials") return `${cost.percent ?? 0}% מעלות החומרים`
  return `${cost.hours ?? 0} שעות × ${formatIls(cost.hourlyRate ?? 0)}`
}

function CostFormDialog({
  open,
  initial,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initial: GlobalCost | null
  onOpenChange: (open: boolean) => void
  onSubmit: (cost: GlobalCost) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<OverheadKind>("fixed")
  const [amount, setAmount] = useState("300")
  const [percent, setPercent] = useState("5")
  const [hours, setHours] = useState("1")
  const [hourlyRate, setHourlyRate] = useState("180")
  const [applyToNewProjects, setApplyToNewProjects] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? "")
    setKind(initial?.kind ?? "fixed")
    setAmount(initial?.amount == null ? "300" : String(initial.amount))
    setPercent(initial?.percent == null ? "5" : String(initial.percent))
    setHours(initial?.hours == null ? "1" : String(initial.hours))
    setHourlyRate(initial?.hourlyRate == null ? "180" : String(initial.hourlyRate))
    setApplyToNewProjects(initial?.applyToNewProjects ?? true)
  }, [open, initial])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("צריך שם לעלות.")
      return
    }
    const now = nowIso()
    const base = {
      id: initial?.id ?? createId(),
      name: name.trim(),
      kind,
      applyToNewProjects,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    let cost: GlobalCost | null = null
    if (kind === "fixed") {
      const value = parseNumber(amount)
      if (value == null || value < 0) {
        toast.error("צריך סכום חיובי.")
        return
      }
      cost = { ...base, amount: value }
    } else if (kind === "percent_materials") {
      const value = parseNumber(percent)
      if (value == null || value < 0) {
        toast.error("צריך אחוז.")
        return
      }
      cost = { ...base, percent: value }
    } else {
      const hourValue = parseNumber(hours)
      const rate = parseNumber(hourlyRate)
      if (hourValue == null || hourValue < 0 || rate == null || rate < 0) {
        toast.error("צריך שעות ותעריף לשעה.")
        return
      }
      cost = { ...base, hours: hourValue, hourlyRate: rate }
    }
    setPending(true)
    try {
      await onSubmit(cost)
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
          <DialogTitle>{initial ? "עריכת עלות" : "עלות קבועה חדשה"}</DialogTitle>
          <DialogDescription>
            שינוי כאן לא מעדכן פרויקטים קיימים. לכל פרויקט נשמר עותק משלו ברגע שהוא נפתח.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="שם">
            <Input className="touch-field" value={name} onChange={(event) => setName(event.target.value)} placeholder="פחת חומר" />
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
            <Field label="סכום לפרויקט (₪)">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
          ) : null}
          {kind === "percent_materials" ? (
            <Field label="אחוז מעלות החומרים" hint="האחוז חל על פרופילים, לוחות, צבע ופריטים אחרים. לא על ברגים, עבודה או הובלה.">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={percent} onChange={(event) => setPercent(event.target.value)} />
            </Field>
          ) : null}
          {kind === "hours" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="שעות">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} />
              </Field>
              <Field label="₪ לשעה">
                <Input className="touch-field tabular-nums" inputMode="decimal" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />
              </Field>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
            <div>
              <p className="text-sm font-medium">להוסיף לפרויקטים חדשים</p>
              <p className="text-xs text-muted-foreground">אפשר להסיר או לשנות את הסכום בתוך כל פרויקט.</p>
            </div>
            <Switch checked={applyToNewProjects} onCheckedChange={setApplyToNewProjects} />
          </div>
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
