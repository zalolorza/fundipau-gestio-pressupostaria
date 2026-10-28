import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AcceptInviteForm } from "@/components/users/accept-invite-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getInvitationByToken } from "@/server/queries"

export const metadata: Metadata = { title: "Accepta la invitació" }

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await getInvitationByToken(token)
  if (!invite) notFound()

  if (invite.acceptedAt) {
    return (
      <InviteMessage
        title="Invitació ja utilitzada"
        description="Aquest enllaç ja s’ha fet servir per crear un compte."
      />
    )
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    return (
      <InviteMessage
        title="Invitació caducada"
        description="Demana a l’equip que te’n generi una de nova."
      />
    )
  }

  return <AcceptInviteForm token={token} email={invite.email} />
}

function InviteMessage({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <Button asChild>
          <Link href="/login">Ves a iniciar sessió</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
