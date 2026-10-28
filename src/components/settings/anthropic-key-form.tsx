"use client";

import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  removeAnthropicApiKey,
  saveAnthropicApiKey,
} from "@/server/settings-actions";

const API_KEY_STEPS = [
  <>
    Ves a{" "}
    <a
      href="https://console.anthropic.com/"
      target="_blank"
      rel="noreferrer"
      className="text-primary hover:underline"
    >
      console.anthropic.com
    </a>
    . Crea o enllaça el compte de Claude si fa falta.
  </>,
  <>Clica «Obtener clave de API».</>,
  <>
    Selecciona «Caduca» → <em>nunca</em>.
  </>,
  <>Crea la clau.</>,
  <>Haureu d&apos;afegir diners perquè el consum va a demanda.</>,
  <>
    Copia la clau que et surt, un text llarg tipus{" "}
    <code className="rounded bg-muted px-1 py-0.5 text-xs">sk-ant-…</code>.
  </>,
  <>Enganxa la clau aquí i desa-la.</>,
] as const;

function AnthropicKeyHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-0.5 inline-flex size-4 align-text-bottom text-muted-foreground hover:text-foreground"
          aria-label="Com obtenir una clau d'Anthropic"
        >
          <InfoIcon className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Com obtenir la clau d&apos;Anthropic</DialogTitle>
          <DialogDescription>
            Passos per crear una clau API a la consola d&apos;Anthropic i
            enganxar-la aquí.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 text-sm text-muted-foreground pl-10!">
          {API_KEY_STEPS.map((step, i) => (
            <li key={i} className="pl-2!">
              {step}
            </li>
          ))}
        </ol>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function AnthropicKeyForm({
  configured,
  hint,
}: {
  configured: boolean;
  hint: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [apiKey, setApiKey] = useState("");

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveAnthropicApiKey(apiKey);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Clau d'Anthropic desada");
      setApiKey("");
      router.refresh();
    });
  }

  function onClear() {
    start(async () => {
      const res = await removeAnthropicApiKey();
      if (!res.ok) return void toast.error(res.error);
      toast.success("Clau d'Anthropic eliminada");
      setApiKey("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSave} className="max-w-xl space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="anthropicKey">
            Clau API d&apos;Anthropic
          </FieldLabel>
          <Input
            id="anthropicKey"
            name="anthropicKey"
            type="password"
            autoComplete="off"
            placeholder={
              configured
                ? "Enganxa una clau nova per substituir-la"
                : "sk-ant-…"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
          <div
            data-slot="field-description"
            className="text-left text-sm leading-normal font-normal text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary"
          >
            {configured ? (
              <>
                Ara mateix hi ha una clau configurada ({hint}). Serveix per
                omplir automàticament els camps buits quan s&apos;adjunta una
                factura. Obté una nova clau a{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  console.anthropic.com
                </a>
                .
              </>
            ) : (
              <>
                Sense clau, l&apos;adjunt d&apos;una factura no farà extracció
                automàtica. Obté la clau a{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  console.anthropic.com
                </a>
                .
              </>
            )}{" "}
            <AnthropicKeyHelpDialog />
          </div>
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !apiKey.trim()}>
          {pending
            ? "Desant…"
            : configured
              ? "Substitueix la clau"
              : "Desa la clau"}
        </Button>
        {configured && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClear}
          >
            Elimina la clau
          </Button>
        )}
      </div>
    </form>
  );
}
