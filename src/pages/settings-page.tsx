import { useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Field } from "@/components/field"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useData } from "@/data/context"
import type { BackupData } from "@/data/types"
import { parseNumber } from "@/lib/format"

export function SettingsPage() {
  const data = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [vatDraft, setVatDraft] = useState<string | null>(null)
  const [confirmImport, setConfirmImport] = useState<BackupData | null>(null)
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [pending, setPending] = useState(false)

  if (data.loading && !data.ready) return <LoadingState />
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />

  const vatValue = vatDraft ?? String(data.settings.vatRate)

  async function saveVat(nextRate: number, includeVat: boolean) {
    if (nextRate < 0 || nextRate > 100) {
      toast.error("אחוז המע״מ צריך להיות בין 0 ל־100.")
      return
    }
    await data.saveSettings({ vatRate: nextRate, includeVat })
  }

  function exportJson() {
    const backup = data.exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `pergolacost-${backup.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("הגיבוי ירד למכשיר")
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">הגדרות</h1>
        <p className="mt-1 text-sm text-muted-foreground">מע״מ, גיבוי, וסנכרון לחשבון Google.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>חשבון וסנכרון</CardTitle>
          <CardDescription>
            {data.mode === "firestore"
              ? "הנתונים נשמרים ב-Firestore תחת החשבון שמחובר, וזמינים גם בלי רשת אחרי הטעינה הראשונה."
              : "כרגע הנתונים נשמרים רק במכשיר הזה (IndexedDB)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!data.firebaseConfigured ? (
            <p className="text-sm leading-6">
              Firebase לא הוגדר. האפליקציה עובדת במלואה על המכשיר, בלי ענן. כדי לסנכרן בין טלפון למחשב, יוצרים פרויקט Firebase, מפעילים Google ו-Firestore, ומדביקים את המפתחות לקובץ <span className="font-medium">.env</span> לפי ה-README. עד אז אין צורך בחשבון.
            </p>
          ) : data.user ? (
            <div className="grid gap-3">
              <p className="text-sm">
                מחוברים כ־<span className="font-medium">{data.user.displayName || data.user.email || "חשבון Google"}</span>
                {data.user.email ? ` (${data.user.email})` : ""}. הנתונים בענן מבודדים לחשבון הזה.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-11" onClick={() => void data.signOut()}>
                  התנתקות
                </Button>
                <Button variant="secondary" className="h-11" onClick={() => setConfirmCopy(true)}>
                  העתקת הנתונים מהמכשיר לחשבון
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm leading-6">
                Firebase מוגדר, אבל עדיין לא התחברתם. עד ההתחברות העבודה נשמרת מקומית. אחרי התחברות עם Google הנתונים עוברים לחשבון, בנפרד מהעותק שבמכשיר. אפשר לייצא גיבוי עכשיו ולייבא אותו אחרי ההתחברות.
              </p>
              <Button
                className="h-11 w-fit"
                onClick={() => {
                  void data.signIn().catch((error: unknown) => {
                    toast.error(error instanceof Error ? error.message : "ההתחברות נכשלה")
                  })
                }}
              >
                התחברות עם Google
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>מע״מ</CardTitle>
          <CardDescription>ברירת המחדל בישראל היא 18%. מחירי המחירון נשמרים לפני מע״מ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="אחוז מע״מ">
            <Input
              className="touch-field tabular-nums"
              inputMode="decimal"
              value={vatValue}
              onChange={(event) => setVatDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseNumber(vatValue)
                if (parsed == null) {
                  toast.error("אחוז מע״מ לא תקין.")
                  setVatDraft(null)
                  return
                }
                void saveVat(parsed, data.settings.includeVat)
                  .then(() => setVatDraft(null))
                  .catch(() => toast.error("שמירת המע״מ נכשלה"))
              }}
            />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">להציג סכומים כולל מע״מ</p>
              <p className="text-xs text-muted-foreground">הרווח והמרווח מחושבים מול הסכום שמוצג.</p>
            </div>
            <Switch
              checked={data.settings.includeVat}
              onCheckedChange={(includeVat) => {
                const parsed = parseNumber(vatValue) ?? data.settings.vatRate
                void saveVat(parsed, includeVat).catch(() => toast.error("שמירת המע״מ נכשלה"))
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>גיבוי</CardTitle>
          <CardDescription>
            קובץ JSON עם המחירון, הפרויקטים, השורות, התקורה וההגדרות. עובד גם במצב מקומי וגם בענן. ייבוא מחליף את כל הנתונים במצב הנוכחי.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button className="h-11" onClick={exportJson}>
            ייצוא JSON
          </Button>
          <Button variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
            ייבוא JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const parsed = JSON.parse(String(reader.result)) as BackupData
                  setConfirmImport(parsed)
                } catch {
                  toast.error("הקובץ אינו JSON תקין.")
                }
              }
              reader.readAsText(file)
            }}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmImport != null}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setConfirmImport(null)
        }}
        title="להחליף את כל הנתונים?"
        description="הייבוא מוחק את המחירון, הפרויקטים וההגדרות שבמצב הנוכחי ומחליף אותם בקובץ."
        confirmLabel="ייבוא"
        onConfirm={() => {
          if (!confirmImport) return
          setPending(true)
          void data
            .importBackup(confirmImport)
            .then(() => {
              toast.success("הגיבוי יובא")
              setConfirmImport(null)
            })
            .catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : "הייבוא נכשל")
            })
            .finally(() => setPending(false))
        }}
      />
      <ConfirmDialog
        open={confirmCopy}
        pending={pending}
        onOpenChange={setConfirmCopy}
        title="להעתיק את נתוני המכשיר לחשבון?"
        description="הפעולה מחליפה את מה שנמצא כרגע בענן בעותק שנשמר בדפדפן הזה."
        confirmLabel="העתקה"
        onConfirm={() => {
          setPending(true)
          void data
            .copyLocalToAccount()
            .then(() => {
              toast.success("הנתונים המקומיים הועתקו לחשבון")
              setConfirmCopy(false)
            })
            .catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : "ההעתקה נכשלה")
            })
            .finally(() => setPending(false))
        }}
      />
    </div>
  )
}
