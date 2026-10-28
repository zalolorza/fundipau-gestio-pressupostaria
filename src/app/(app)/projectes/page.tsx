import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { ProjectsBrowser } from "@/components/projects/projects-browser"
import { Button } from "@/components/ui/button"
import { getClientOptions, listProjects } from "@/server/queries"

export const metadata: Metadata = { title: "Projectes" }

export default async function ProjectsPage() {
  const [projects, clientOptions] = await Promise.all([listProjects(), getClientOptions()])
  return (
    <>
      <PageHeader crumbs={[{ label: "Gestió" }, { label: "Projectes" }]} />
      <PageBody>
        <PageTitle title="Projectes" description="Pressupost, costos imputats i finançadors de cada projecte.">
          <ProjectDialog clientOptions={clientOptions}>
            <Button>
              <PlusIcon /> Nou projecte
            </Button>
          </ProjectDialog>
        </PageTitle>
        <ProjectsBrowser projects={projects} />
      </PageBody>
    </>
  )
}
