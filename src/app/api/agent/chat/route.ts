import { createAnthropic } from "@ai-sdk/anthropic"
import { stepCountIs, streamText, type UIMessage } from "ai"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import {
  messagesWithAttachments,
  parseAgentAttachments,
} from "@/lib/agent/attachments"
import { parsePageContext } from "@/lib/agent/page-context"
import {
  lastUserTextFromMessages,
  selectAgentModel,
} from "@/lib/agent/select-model"
import { buildAgentSystemPrompt } from "@/lib/agent/system-prompt"
import { createAgentTools } from "@/lib/agent/tools"
import { getAnthropicApiKey } from "@/lib/app-settings"
import { auth } from "@/lib/auth"

export const maxDuration = 60

const HISTORY_WINDOW = 12

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "No autenticat" }, { status: 401 })
  }

  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "La clau d'Anthropic no està configurada. Una administradora l'ha de desar a Ajustos.",
      },
      { status: 503 }
    )
  }

  let body: { messages?: UIMessage[]; pathname?: string; attachments?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Cos de la petició no vàlid" }, { status: 400 })
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  const windowed = messages.slice(-HISTORY_WINDOW)
  const attachments = parseAgentAttachments(body.attachments)
  const pageCtx = parsePageContext(
    typeof body.pathname === "string" ? body.pathname : "/"
  )
  const modelId = selectAgentModel(lastUserTextFromMessages(windowed), {
    hasAttachments: attachments.length > 0,
  })

  const anthropic = createAnthropic({ apiKey })
  const system = buildAgentSystemPrompt(pageCtx)

  let modelMessages
  try {
    modelMessages = await messagesWithAttachments(windowed, attachments)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "No s'han pogut llegir els arxius adjuntats" },
      { status: 400 }
    )
  }

  const result = streamText({
    model: anthropic(modelId),
    system,
    messages: modelMessages,
    tools: createAgentTools(),
    stopWhen: stepCountIs(8),
    providerOptions: {
      anthropic: {
        effort: "low",
        cacheControl: { type: "ephemeral" },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
