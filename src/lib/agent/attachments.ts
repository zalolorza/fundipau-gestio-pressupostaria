import "server-only"

import { get } from "@vercel/blob"
import type { FilePart, ModelMessage, UIMessage } from "ai"
import { convertToModelMessages } from "ai"

import {
  INVOICE_FILE_TYPES,
  isInvoiceFilePathname,
} from "@/lib/invoice-file"

export type AgentAttachment = {
  pathname: string
  fileName: string
  mediaType: string
}

const ALLOWED = new Set<string>(INVOICE_FILE_TYPES)

export function parseAgentAttachments(raw: unknown): AgentAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: AgentAttachment[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const pathname = String((item as { pathname?: unknown }).pathname ?? "")
    const fileName = String((item as { fileName?: unknown }).fileName ?? "")
    const mediaType = String((item as { mediaType?: unknown }).mediaType ?? "")
    if (!isInvoiceFilePathname(pathname)) continue
    if (!ALLOWED.has(mediaType)) continue
    if (!fileName.trim()) continue
    out.push({ pathname, fileName: fileName.trim(), mediaType })
  }
  return out.slice(0, 5)
}

/** Treu file parts amb URL no-data (p. ex. /api/invoices/file) perquè convertToModelMessages no els descarregui. */
export function stripNonDataFileParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: (m.parts ?? []).filter((p) => {
      if (p.type !== "file") return true
      return typeof p.url === "string" && p.url.startsWith("data:")
    }),
  }))
}

async function loadAttachmentParts(attachments: AgentAttachment[]): Promise<FilePart[]> {
  const parts: FilePart[] = []
  for (const a of attachments) {
    const result = await get(a.pathname, { access: "private" })
    if (!result?.stream) continue
    const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer())
    parts.push({
      type: "file",
      data: bytes,
      mediaType: a.mediaType,
      filename: a.fileName,
    })
  }
  return parts
}

/**
 * Converteix missatges UI → model i, si hi ha adjunts del torn actual,
 * els carrega des del Blob i els afegeix al darrer missatge d'usuari.
 */
export async function messagesWithAttachments(
  messages: UIMessage[],
  attachments: AgentAttachment[]
): Promise<ModelMessage[]> {
  const cleaned = stripNonDataFileParts(messages)
  const modelMessages = await convertToModelMessages(cleaned)

  if (!attachments.length) return modelMessages

  const fileParts = await loadAttachmentParts(attachments)
  if (!fileParts.length) return modelMessages

  const hint = {
    type: "text" as const,
    text:
      "Arxius adjuntats (pathname al Blob, usa'ls a saveInvoice.file o extractInvoiceFromPathname):\n" +
      attachments
        .map((a) => `- ${a.fileName} | ${a.mediaType} | ${a.pathname}`)
        .join("\n"),
  }

  for (let i = modelMessages.length - 1; i >= 0; i--) {
    const msg = modelMessages[i]
    if (msg.role !== "user") continue
    const content = msg.content
    if (typeof content === "string") {
      modelMessages[i] = {
        role: "user",
        content: [hint, { type: "text", text: content }, ...fileParts],
      }
    } else if (Array.isArray(content)) {
      modelMessages[i] = {
        role: "user",
        content: [hint, ...content, ...fileParts],
      }
    }
    break
  }

  return modelMessages
}
