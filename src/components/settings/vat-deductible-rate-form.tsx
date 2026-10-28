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
import { saveDefaultVatDeductibleRate } from "@/server/settings-actions"

export function VatDeductibleRateForm({ defaultRate }: { defaultRate: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rate, setRate] = useState(defaultRate)
  const [prevDefault, setPrevDefault] = useState(defaultRate)
  if (defaultRate !== prevDefault) {
    setPrevDefault(defaultRate)
    setRate(defaultRate)
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await saveDefaultVatDeductibleRate(rate)
      if (!res.ok) return void toast.error(res.error)
      toast.success("IVA deduïble per defecte desat")
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSave} className="max-w-xl space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="vatDeductibleRate">IVA deduïble per defecte (%)</FieldLabel>
          <Input
            id="vatDeductibleRate"
            name="vatDeductibleRate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            value={Number.isNaN(rate) ? "" : rate}
            onChange={(e) => setRate(e.target.valueAsNumber)}
          />
          <FieldDescription>
            Percentatge de l&apos;IVA de la factura que es considera deduïble. Les factures
            noves el reben per defecte; el cost imputable és la base més aquesta part de
            l&apos;IVA (no l&apos;IVA sencer). Es pot canviar factura a factura o en edició
            massiva.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending || Number.isNaN(rate)}>
        {pending ? "Desant…" : "Desa"}
      </Button>
    </form>
  )
}
