export const AGENT_HAIKU = "claude-haiku-5-5"
export const AGENT_SONNET = "claude-sonnet-5-5"

export type AgentModelId = typeof AGENT_HAIKU | typeof AGENT_SONNET

const COMPLEX_WRITE =
  /\b(assigna|assignar|crea|crear|actualitza|actualitzar|desa|desar|modifica|modificar|canvia|canviar|afegeix|afegir|treu|treure|elimina|eliminar|reparteix|repartir|extén|extendre|bulk|divers|varis|vàries|tots|totes|i també|i després)\b/i

const MULTI_INTENT = /(?:\b(?:i|després|també|a més)\b.*){2,}/i

/**
 * Escull Haiku per defecte i Sonnet només quan el torn sembla multi-pas / mutació complexa
 * o quan hi ha arxius adjuntats (visió / PDF). Invisible a l'usuari.
 */
export function selectAgentModel(
  lastUserText: string,
  opts?: { hasAttachments?: boolean }
): AgentModelId {
  if (opts?.hasAttachments) return AGENT_SONNET

  const text = lastUserText.trim()
  if (!text) return AGENT_HAIKU

  const looksComplexWrite = COMPLEX_WRITE.test(text) && (
    MULTI_INTENT.test(text) ||
    (text.match(/\b(projecte|factura|nòmina|nomina|client|proveïdor|proveidor|activitat|categoria)\b/gi)?.length ?? 0) >= 2 ||
    text.length > 280
  )

  return looksComplexWrite ? AGENT_SONNET : AGENT_HAIKU
}

/** Extreu el text del darrer missatge d'usuari (UIMessage parts o content string). */
export function lastUserTextFromMessages(
  messages: { role: string; parts?: { type: string; text?: string }[]; content?: unknown }[]
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role !== "user") continue
    if (Array.isArray(m.parts)) {
      return m.parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text!)
        .join("\n")
        .trim()
    }
    if (typeof m.content === "string") return m.content.trim()
  }
  return ""
}
