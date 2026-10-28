"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { removeAnthropicApiKey, saveAnthropicApiKey } from "@/server/settings-actions"

export function AnthropicKeyForm({
  configured,
  hint,
}: {
  configured: boolean
  hint: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [apiKey, setApiKey] = useState("")

  function onSave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await saveAnthropicApiKey(apiKey)
      if (!res.ok) return void toast.error(res.error)
      toast.success("Clau d'Anthropic desada")
      setApiKey("")
      router.refresh()
    })
  }

  function onClear() {
    start(async () => {
      const res = await removeAnthropicApiKey()
      if (!res.ok) return void toast.error(res.error)
      toast.success("Clau d'Anthropic eliminada")
      setApiKey("")
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSave} className="max-w-xl space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="anthropicKey">Clau API d&apos;Anthropic</FieldLabel>
          <Input
            id="anthropicKey"
            name="anthropicKey"
            type="password"
            autoComplete="off"
            placeholder={configured ? "Enganxa una clau nova per substituir-la" : "sk-ant-…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
          <FieldDescription>
            {configured ? (
              <>
                Ara mateix hi ha una clau configurada ({hint}). Es desa xifrada a la base de
                dades; només les administradores la poden gestionar. Serveix per omplir
                automàticament els camps buits quan s&apos;adjunta una factura.
              </>
            ) : (
              <>
                Sense clau, l&apos;adjunt d&apos;una factura no farà extracció automàtica. Obté la clau a{" "}
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
            )}
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !apiKey.trim()}>
          {pending ? "Desant…" : configured ? "Substitueix la clau" : "Desa la clau"}
        </Button>
        {configured && (
          <Button type="button" variant="outline" disabled={pending} onClick={onClear}>
            Elimina la clau
          </Button>
        )}
      </div>
    </form>
  )
}
