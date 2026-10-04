import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { DataProvider } from "@/data/context"
import { CatalogPage } from "@/pages/catalog-page"
import { GlobalCostsPage } from "@/pages/costs-page"
import { ProjectPage } from "@/pages/project-page"
import { ProjectsPage } from "@/pages/projects-page"
import { SettingsPage } from "@/pages/settings-page"

export default function App() {
  return (
    <BrowserRouter>
        <DataProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/costs" element={<GlobalCostsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell>
          <Toaster dir="rtl" position="top-center" />
        </DataProvider>
    </BrowserRouter>
  )
}
