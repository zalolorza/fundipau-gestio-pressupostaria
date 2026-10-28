"use server"

import { get } from "@vercel/blob"
import { z } from "zod"

import { getAnthropicApiKeyStatus } from "@/lib/app-settings"
import { requireSession } from "@/lib/auth"
import { extractInvoiceFieldsFromBytes, type ExtractedInvoiceFields } from "@/lib/invoice-extract"
import { INVOICE_FILE_TYPES, isInvoiceFilePathname } from "@/lib/invoice-file"

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dades no vàlides" }
  console.error(e)
  return { ok: false, error: e instanceof Error ? e.message : "S'ha produït un error" }
}

/**
 * Llegeix un arxiu de factura ja pujat al Blob i n'extreu els camps amb Claude.
 */
export async function extractInvoiceFromPathname(
  pathname: string
): Promise<ActionResult<ExtractedInvoiceFields>> {
  await requireSession()
  try {
    if (!pathname || !isInvoiceFilePathname(pathname)) {
      return { ok: false, error: "Pathname no vàlid" }
    }

    const status = await getAnthropicApiKeyStatus()
    if (!status.configured) {
      return {
        ok: false,
        error:
          "L'extracció automàtica no està configurada (cal la clau d'Anthropic a Ajustaments).",
      }
    }

    const result = await get(pathname, { access: "private" })
    if (!result || result.statusCode === 304 || !result.stream) {
      return { ok: false, error: "No s'ha trobat l'arxiu pujat" }
    }

    const mediaType = result.blob.contentType?.split(";")[0]?.trim() ?? ""
    if (!(INVOICE_FILE_TYPES as readonly string[]).includes(mediaType)) {
      return { ok: false, error: "Tipus d'arxiu no compatible" }
    }

    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
    const data = await extractInvoiceFieldsFromBytes(bytes, mediaType)
    return { ok: true, data }
  } catch (e) {
    return fail(e)
  }
}
