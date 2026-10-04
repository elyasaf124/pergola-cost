import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import type { Project, ProjectStatus } from "@/data/types"
import type { ProjectDraft } from "@/data/context"
import { Field } from "@/components/field"
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
import { Textarea } from "@/components/ui/textarea"
import { parseNumber } from "@/lib/format"
import { STATUS_LABEL } from "@/lib/labels"

const STATUSES: ProjectStatus[] = ["quote", "in_progress", "done"]

export function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Project | null
  onSubmit: (draft: ProjectDraft) => Promise<void>
}) {
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [widthM, setWidthM] = useState("")
  const [depthM, setDepthM] = useState("")
  const [heightM, setHeightM] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("quote")
  const [sellingPrice, setSellingPrice] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setCustomerName(initial?.customerName ?? "")
    setPhone(initial?.phone ?? "")
    setAddress(initial?.address ?? "")
    setWidthM(initial?.widthM == null ? "" : String(initial.widthM))
    setDepthM(initial?.depthM == null ? "" : String(initial.depthM))
    setHeightM(initial?.heightM == null ? "" : String(initial.heightM))
    setNotes(initial?.notes ?? "")
    setStatus(initial?.status ?? "quote")
    setSellingPrice(initial?.sellingPrice == null ? "" : String(initial.sellingPrice))
  }, [open, initial])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = customerName.trim()
    if (!name) {
      toast.error("צריך שם לקוח כדי לפתוח פרויקט.")
      return
    }
    const width = optionalNumber(widthM, "רוחב")
    const depth = optionalNumber(depthM, "עומק")
    const height = optionalNumber(heightM, "גובה")
    const price = optionalNumber(sellingPrice, "מחיר מכירה")
    if (width === "invalid" || depth === "invalid" || height === "invalid" || price === "invalid") return
    setPending(true)
    try {
      await onSubmit({
        customerName: name,
        phone: phone.trim(),
        address: address.trim(),
        widthM: width,
        depthM: depth,
        heightM: height,
        notes: notes.trim(),
        status,
        sellingPrice: price,
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שמירת הפרויקט נכשלה.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "עריכת פרויקט" : "פרויקט חדש"}</DialogTitle>
          <DialogDescription>
            פרטי הלקוח והמידות. עלויות שמסומנות «לפרויקטים חדשים» יתווספו אוטומטית.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="שם הלקוח">
            <Input className="touch-field" value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="טלפון">
              <Input className="touch-field" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="סטטוס">
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                <SelectTrigger className="touch-field w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="כתובת">
            <Input className="touch-field" value={address} onChange={(event) => setAddress(event.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="רוחב (מ׳)">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={widthM} onChange={(event) => setWidthM(event.target.value)} />
            </Field>
            <Field label="עומק (מ׳)">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={depthM} onChange={(event) => setDepthM(event.target.value)} />
            </Field>
            <Field label="גובה (מ׳)">
              <Input className="touch-field tabular-nums" inputMode="decimal" value={heightM} onChange={(event) => setHeightM(event.target.value)} />
            </Field>
          </div>
          <Field label="מחיר מכירה ללקוח (₪)" hint="אפשר להשאיר ריק עד שסוגרים מחיר. הרווח מחושב מול העלות.">
            <Input className="touch-field tabular-nums" inputMode="decimal" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} />
          </Field>
          <Field label="הערות">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="גוון, שיפוע, הערות מהשטח" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" className="h-11" disabled={pending}>
              {initial ? "שמירה" : "פתיחת פרויקט"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function optionalNumber(value: string, label: string): number | null | "invalid" {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseNumber(trimmed)
  if (parsed == null || parsed < 0) {
    toast.error(`${label} צריך להיות מספר חיובי.`)
    return "invalid"
  }
  return parsed
}
