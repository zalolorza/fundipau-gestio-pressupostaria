import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { PayrollCreateDialog } from "@/components/payroll/payroll-create-dialog"
import { PayrollsBrowser } from "@/components/payroll/payrolls-browser"
import { Button } from "@/components/ui/button"
import {
  activitiesByProjectMap,
  fundersByProjectMap,
  getProjectOptions,
  listCategories,
  listPayrolls,
  listProjectActivities,
  listProjectFunders,
} from "@/server/queries"

export const metadata: Metadata = { title: "Nòmines" }

export default async function PayrollsPage() {
  const [payrolls, projects, categories, activities, funders] = await Promise.all([
    listPayrolls(),
    getProjectOptions(),
    listCategories(),
    listProjectActivities(),
    listProjectFunders(),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }))
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }))
  const activitiesByProject = activitiesByProjectMap(activities)
  const fundersByProject = fundersByProjectMap(funders)
  return (
    <>
      <PageHeader crumbs={[{ label: "Costos" }, { label: "Nòmines" }]} />
      <PageBody>
        <PageTitle
          title="Nòmines"
          description="Cada nòmina té un registre per mes, que es pot repartir entre projectes."
        >
          <PayrollCreateDialog
            projectOptions={projectOptions}
            activitiesByProject={activitiesByProject}
            fundersByProject={fundersByProject}
            categories={categoryOptions}
          >
            <Button>
              <PlusIcon /> Nova nòmina
            </Button>
          </PayrollCreateDialog>
        </PageTitle>
        <PayrollsBrowser payrolls={payrolls} />
      </PageBody>
    </>
  )
}
