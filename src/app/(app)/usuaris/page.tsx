import type { Metadata } from "next"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { InviteDialog } from "@/components/users/invite-dialog"
import { PendingInvites } from "@/components/users/pending-invites"
import { UsersTable } from "@/components/users/users-table"
import { requireAdmin } from "@/lib/auth"
import { isSmtpConfigured } from "@/lib/email"
import { listPendingInvitations, listUsers } from "@/server/queries"

export const metadata: Metadata = { title: "Usuàries" }

function appBaseUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export default async function UsersPage() {
  const session = await requireAdmin()
  const [users, invites] = await Promise.all([listUsers(), listPendingInvitations()])
  const smtpReady = isSmtpConfigured()
  const base = appBaseUrl()

  return (
    <>
      <PageHeader crumbs={[{ label: "Administració" }, { label: "Usuàries" }]} />
      <PageBody>
        <PageTitle
          title="Usuàries"
          description="Comptes amb accés a la gestió. Només les administradores poden convidar o eliminar."
        >
          <InviteDialog smtpReady={smtpReady} />
        </PageTitle>

        <UsersTable users={users} currentUserId={session.user.id} />

        <PendingInvites
          invites={invites.map((inv) => ({
            ...inv,
            url: `${base}/convidar/${inv.token}`,
          }))}
        />
      </PageBody>
    </>
  )
}
