import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { PayrollCreateDialog } from "@/components/payroll/payroll-create-dialog"
import { PayrollsBrowser } from "@/components/payroll/payrolls-browser"
import { Button } from "@/components/ui/button"
import { getProjectOptions, listPayrolls } from "@/server/queries"

export const metadata: Metadata = { title: "Nòmines" }

export default async function PayrollsPage() {
  const [payrolls, projects] = await Promise.all([listPayrolls(), getProjectOptions()])
  const today = new Date().toISOString().slice(0, 10)
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }))
  return (
    <>
      <PageHeader crumbs={[{ label: "Costos" }, { label: "Nòmines" }]} />
      <PageBody>
        <PageTitle
          title="Nòmines"
          description="Cada nòmina té un registre per mes, que es pot repartir entre projectes."
        >
          <PayrollCreateDialog projectOptions={projectOptions}>
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
