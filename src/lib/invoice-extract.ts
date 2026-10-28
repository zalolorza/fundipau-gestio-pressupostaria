import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { getAnthropicApiKey } from "@/lib/app-settings"
import { VAT_RATES } from "@/lib/invoice"
import {
  extractedInvoiceSchema,
  type ExtractedInvoiceFields,
} from "@/lib/invoice-extract-types"
import { INVOICE_FILE_TYPES } from "@/lib/invoice-file"

export type { ExtractedInvoiceFields }

const SYSTEM = `Ets un extractor de dades de factures espanyoles/catalanes.
Llegeix el document i retorna NOMÉS un JSON vàlid (sense markdown) amb aquestes claus:
{
  "number": string | null,
  "issueDate": "YYYY-MM-DD" | null,
  "description": string | null,
  "supplierName": string | null,
  "supplierTaxId": string | null,
  "supplierAddress": string | null,
  "supplierPostalCode": string | null,
  "supplierCity": string | null,
  "baseAmount": number | null,
  "vatRate": number | null,
  "irpfRate": number | null
}
Regles:
- supplier* és el proveïdor / emissor de la factura (qui factura), no el client.
- issueDate en ISO (YYYY-MM-DD).
- baseAmount és la base imposable (sense IVA), en euros.
- vatRate i irpfRate són percentatges (p. ex. 21, 15), no imports.
- Si un camp no es pot llegir amb confiança, posa null.
- description: concepte o resum breu de la factura.`

function nearestVatRate(rate: number): number {
  return VAT_RATES.reduce(
    (best, r) => (Math.abs(r - rate) < Math.abs(best - rate) ? r : best),
    VAT_RATES[0]
  )
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1]?.trim() ?? trimmed
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end < start) throw new Error("La resposta no conté JSON")
  return JSON.parse(raw.slice(start, end + 1))
}

export async function extractInvoiceFieldsFromBytes(
  bytes: Buffer,
  mediaType: string
): Promise<ExtractedInvoiceFields> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    throw new Error(
      "La clau d'Anthropic no està configurada. Una administradora l'ha de desar a Ajustaments."
    )
  }

  if (!(INVOICE_FILE_TYPES as readonly string[]).includes(mediaType)) {
    throw new Error("Tipus d'arxiu no compatible amb l'extracció")
  }

  const client = new Anthropic({ apiKey })
  const data = bytes.toString("base64")

  const content: Anthropic.MessageCreateParams["messages"][0]["content"] =
    mediaType === "application/pdf"
      ? [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data },
          },
          { type: "text", text: "Extreu les dades de la factura en JSON." },
        ]
      : [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
              data,
            },
          },
          { type: "text", text: "Extreu les dades de la factura en JSON." },
        ]

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  })

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")

  const parsed = extractedInvoiceSchema.parse(parseJsonObject(text))

  return {
    ...parsed,
    number: parsed.number?.trim() || null,
    issueDate:
      parsed.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.issueDate)
        ? parsed.issueDate
        : null,
    description: parsed.description?.trim() || null,
    supplierName: parsed.supplierName?.trim() || null,
    supplierTaxId: parsed.supplierTaxId?.trim() || null,
    supplierAddress: parsed.supplierAddress?.trim() || null,
    supplierPostalCode: parsed.supplierPostalCode?.trim() || null,
    supplierCity: parsed.supplierCity?.trim() || null,
    baseAmount:
      parsed.baseAmount != null && Number.isFinite(parsed.baseAmount)
        ? parsed.baseAmount
        : null,
    vatRate:
      parsed.vatRate != null && Number.isFinite(parsed.vatRate)
        ? nearestVatRate(parsed.vatRate)
        : null,
    irpfRate:
      parsed.irpfRate != null && Number.isFinite(parsed.irpfRate)
        ? Math.max(0, parsed.irpfRate)
        : null,
  }
}
