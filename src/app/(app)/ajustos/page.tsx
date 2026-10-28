import type { Metadata } from "next";
import { SettingsIcon } from "lucide-react";

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { AnthropicKeyForm } from "@/components/settings/anthropic-key-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getAnthropicApiKeyStatus } from "@/lib/app-settings";

export const metadata: Metadata = { title: "Ajustos" };

export default async function SettingsPage() {
  await requireAdmin();
  const anthropic = await getAnthropicApiKeyStatus();

  return (
    <>
      <PageHeader crumbs={[{ label: "Administració" }, { label: "Ajustos" }]} />
      <PageBody>
        <PageTitle
          title="Ajustos"
          description="Configuració global de l'aplicació. Només accessible per administradores."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SettingsIcon className="size-4" />
              Extracció de factures (Claude)
            </CardTitle>
            <CardDescription>
              Quan s&apos;adjunta un PDF o una imatge a una factura, Claude pot
              llegir l&apos;arxiu i omplir els camps buits del formulari.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnthropicKeyForm
              configured={anthropic.configured}
              hint={anthropic.hint}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
