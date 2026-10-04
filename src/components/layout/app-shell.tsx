import type { ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Calculator, ClipboardList, Settings, Tags } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "פרויקטים", icon: ClipboardList },
  { to: "/catalog", label: "מחירון", icon: Tags },
  { to: "/costs", label: "תקורה", icon: Calculator },
  { to: "/settings", label: "הגדרות", icon: Settings },
]

function isNavActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/" || pathname.startsWith("/projects/")
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background md:grid md:grid-cols-[15.5rem_1fr]">
      <aside className="hidden border-e bg-card md:sticky md:top-0 md:flex md:h-svh md:flex-col">
        <Brand />
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur md:hidden">
          <div className="h-1 bg-primary" />
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">העסק של אליסף</p>
            <p className="text-lg font-semibold leading-tight">עלות פרגולה</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-36 md:px-8 md:py-8 md:pb-10">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <BottomNav />
      </nav>
    </div>
  )
}

function Brand() {
  return (
    <div className="border-b px-5 py-6">
      <div className="mb-4 h-1 w-10 rounded-full bg-primary" />
      <p className="text-xs text-muted-foreground">העסק של אליסף</p>
      <h1 className="text-xl font-semibold leading-tight">עלות פרגולה</h1>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">עלות מדויקת, עד הבורג האחרון.</p>
    </div>
  )
}

function SideNav() {
  const { pathname } = useLocation()
  return (
    <nav className="grid gap-1 p-3">
      {NAV.map((item) => {
        const active = isNavActive(pathname, item.to)
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted",
              active && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

function BottomNav() {
  const { pathname } = useLocation()
  return (
    <ul className="grid grid-cols-4">
      {NAV.map((item) => {
        const active = isNavActive(pathname, item.to)
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] text-muted-foreground",
                active && "text-primary",
              )}
            >
              <item.icon className={cn("size-5", active && "stroke-[2.4]")} />
              {item.label}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}
