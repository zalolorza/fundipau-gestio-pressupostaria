import type { Metadata } from "next"

import { PasswordForm } from "@/components/account/password-form"
import { ProfileForm } from "@/components/account/profile-form"
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireSession } from "@/lib/auth"

export const metadata: Metadata = { title: "El meu compte" }

export default async function AccountPage() {
  const { user } = await requireSession()
  return (
    <>
      <PageHeader crumbs={[{ label: "El meu compte" }]} />
      <PageBody>
        <PageTitle title="El meu compte" description="Les teves dades d'accés." />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Perfil</CardTitle>
              <CardDescription>El nom que apareix al menú.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm name={user.name} email={user.email} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contrasenya</CardTitle>
              <CardDescription>Cal la contrasenya actual per posar-ne una de nova.</CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordForm />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  )
}
