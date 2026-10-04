import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export function LoadingState({ label = "טוען את הנתונים…" }: { label?: string }) {
  return (
    <div className="grid gap-3 py-10" role="status">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-base font-semibold">משהו השתבש</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button className="mt-4 h-11" onClick={onRetry}>
          נסו שוב
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card px-5 py-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}
