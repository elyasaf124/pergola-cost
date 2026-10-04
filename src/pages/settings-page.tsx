import { useRef, useState, type FormEvent } from "react"
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
  const [pending, setPending] = useState(false)
  const [password, setPassword] = useState("")

  if (data.loading && !data.ready && !data.locked) return <LoadingState />
  if (data.error && !data.locked) return <ErrorState message={data.error} onRetry={() => void data.reload()} />

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

  function submitPassword(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    void data
      .login(password)
      .then(() => {
        setPassword("")
        toast.success("הסיסמה נכונה")
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "ההתחברות נכשלה")
      })
      .finally(() => setPending(false))
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">הגדרות</h1>
        <p className="mt-1 text-sm text-muted-foreground">מע״מ, גיבוי, והמסד שהאפליקציה מדברת איתו.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>מסד נתונים</CardTitle>
          <CardDescription>
            {data.mode === "development"
              ? "מצב פיתוח שומר רק במסד המקומי. הוא לא מתחבר ל-Neon ולא יכול לגעת בייצור."
              : "מצב ייצור שומר ב-Neon, במסד נפרד מהמחשב המקומי."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.mode === "development" ? (
            <p className="text-sm leading-6">
              הנתונים נשמרים בתיקייה המקומית <span className="font-medium">data/dev</span>. אין צורך בסיסמה על localhost. מחרוזת החיבור של הייצור לא נטענת כאן.
            </p>
          ) : data.locked ? (
            <form className="grid gap-3" onSubmit={submitPassword}>
              <p className="text-sm leading-6">השרת בייצור דורש סיסמה לפני שרואים פרויקטים.</p>
              <Field label="סיסמה">
                <Input
                  className="touch-field"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Button type="submit" className="h-11 w-fit" disabled={pending || password.length === 0}>
                כניסה
              </Button>
            </form>
          ) : data.passwordRequired ? (
            <div className="grid gap-3">
              <p className="text-sm leading-6">מחוברים לייצור. אותם פרויקטים יופיעו בכל שרת שמשתמש באותו מסד Neon.</p>
              <Button
                variant="outline"
                className="h-11 w-fit"
                onClick={() => {
                  void data.logout().catch(() => toast.error("ההתנתקות נכשלה"))
                }}
              >
                התנתקות
              </Button>
            </div>
          ) : (
            <p className="text-sm leading-6">
              אין סיסמה על שרת הייצור. כל מי שמגיע לשרת רואה את אותם פרויקטים. אפשר להוסיף <span className="font-medium">APP_PASSWORD</span> בסביבת השרת.
            </p>
          )}
        </CardContent>
      </Card>

      {data.ready ? (
        <>
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
                קובץ JSON עם המחירון, הפרויקטים, השורות, התקורה וההגדרות. הייבוא מחליף את כל הנתונים במסד הפעיל.
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
        </>
      ) : null}

      <ConfirmDialog
        open={confirmImport != null}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setConfirmImport(null)
        }}
        title="להחליף את כל הנתונים?"
        description="הייבוא מוחק את המחירון, הפרויקטים וההגדרות במסד הפעיל ומחליף אותם בקובץ."
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
    </div>
  )
}
