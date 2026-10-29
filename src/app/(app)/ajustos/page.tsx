import type { Metadata } from "next";
import { PercentIcon, SettingsIcon, TagsIcon } from "lucide-react";

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { AnthropicKeyForm } from "@/components/settings/anthropic-key-form";
import { CategoriesForm } from "@/components/settings/categories-form";
import { VatDeductibleRateForm } from "@/components/settings/vat-deductible-rate-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import {
  getAnthropicApiKeyStatus,
  getDefaultVatDeductibleRate,
} from "@/lib/app-settings";
import { listCategories } from "@/server/queries";

export const metadata: Metadata = { title: "Ajustos" };

export default async function SettingsPage() {
  await requireAdmin();
  const [anthropic, vatDeductibleRate, categories] = await Promise.all([
    getAnthropicApiKeyStatus(),
    getDefaultVatDeductibleRate(),
    listCategories(),
  ]);

  return (
    <>
      <PageHeader crumbs={[{ label: "Administració" }, { label: "Ajustos" }]} />
      <PageBody>
        <PageTitle
          title="Ajustos"
          description="Configuració global de l'aplicació. Només accessible per administradores."
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PercentIcon className="size-4" />
                IVA deduïble
              </CardTitle>
              <CardDescription>
                Percentatge de l&apos;IVA de les factures que forma part del
                cost imputable. S&apos;aplica per defecte a les factures noves.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VatDeductibleRateForm defaultRate={vatDeductibleRate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SettingsIcon className="size-4" />
                Extracció de factures (Claude)
              </CardTitle>
              <CardDescription>
                Quan s&apos;adjunta un PDF o una imatge a una factura, Claude
                pot llegir l&apos;arxiu i omplir els camps buits del formulari.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnthropicKeyForm
                configured={anthropic.configured}
                hint={anthropic.hint}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TagsIcon className="size-4" />
                Categories
              </CardTitle>
              <CardDescription>
                Etiquetes globals per classificar factures i nòmines. Pots
                crear-ne, canviar-ne el nom o eliminar-les.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoriesForm categories={categories} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
