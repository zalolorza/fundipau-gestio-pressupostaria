"use client"

import { useChat } from "@ai-sdk/react"
import { upload } from "@vercel/blob/client"
import { DefaultChatTransport, type FileUIPart } from "ai"
import {
  FileIcon,
  Loader2Icon,
  MessageSquareIcon,
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

import { AgentMarkdown } from "@/components/agent/agent-markdown"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  INVOICE_FILE_MAX_BYTES,
  INVOICE_FILE_PREFIX,
  INVOICE_FILE_TYPES,
  invoiceFileHref,
} from "@/lib/invoice-file"
import { cn } from "@/lib/utils"

const EXAMPLES = [
  "Quin pressupost queda en aquest projecte?",
  "Cerca factures pendents d'assignar",
  "Assigna la factura més recent al projecte actual al 50%",
]

type PendingFile = { id: string; file: File }

type ChatAttachment = {
  pathname: string
  fileName: string
  mediaType: string
}

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("")
}

function messageFiles(
  parts: { type: string; url?: string; filename?: string; mediaType?: string }[]
): FileUIPart[] {
  return parts.filter((p): p is FileUIPart => p.type === "file" && typeof p.url === "string")
}

function hasToolActivity(parts: { type: string }[]): boolean {
  return parts.some(
    (p) =>
      p.type.startsWith("tool-") ||
      p.type === "dynamic-tool" ||
      p.type === "tool-invocation"
  )
}

function validateFile(file: File): string | null {
  if (file.size > INVOICE_FILE_MAX_BYTES) return "L'arxiu supera els 20 MB"
  if (!(INVOICE_FILE_TYPES as readonly string[]).includes(file.type)) {
    return "Només s'admeten PDF o imatges (JPEG, PNG, WebP)"
  }
  return null
}

export function AgentSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [input, setInput] = React.useState("")
  const [pending, setPending] = React.useState<PendingFile[]>([])
  const [uploading, setUploading] = React.useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const transport = React.useMemo(
    () => new DefaultChatTransport({ api: "/api/agent/chat" }),
    []
  )

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    transport,
    onFinish: () => {
      router.refresh()
    },
    onError: (err) => {
      const raw = err.message?.trim()
      if (raw?.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw) as { error?: string }
          if (parsed.error) err.message = parsed.error
        } catch {
          /* ignore */
        }
      }
    },
  })

  const busy = status === "submitted" || status === "streaming" || uploading

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status, pending])

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    const next: PendingFile[] = []
    for (const file of Array.from(list)) {
      const err = validateFile(file)
      if (err) {
        toast.error(`${file.name}: ${err}`)
        continue
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file })
    }
    if (next.length) {
      setPending((prev) => [...prev, ...next].slice(0, 5))
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function uploadPending(): Promise<ChatAttachment[]> {
    const uploaded: ChatAttachment[] = []
    for (const { file } of pending) {
      const blob = await upload(`${INVOICE_FILE_PREFIX}${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/invoices/upload",
      })
      uploaded.push({
        pathname: blob.pathname,
        fileName: file.name,
        mediaType: file.type,
      })
    }
    return uploaded
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    if ((!trimmed && pending.length === 0) || busy) return
    clearError()
    setUploading(true)
    try {
      const attachments = pending.length ? await uploadPending() : []
      setPending([])
      setInput("")
      const files: FileUIPart[] = attachments.map((a) => ({
        type: "file",
        filename: a.fileName,
        mediaType: a.mediaType,
        url: invoiceFileHref(a.pathname),
      }))
      await sendMessage(
        {
          text: trimmed || (attachments.length ? "He adjuntat arxius." : ""),
          files: files.length ? files : undefined,
        },
        { body: { pathname, attachments } }
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No s'ha pogut pujar l'arxiu")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareIcon className="size-4" />
            Agent CRM
          </SheetTitle>
          <SheetDescription>
            Consulta i modifica projectes, factures, nòmines i clients. Pots
            adjuntar PDF o imatges.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <SparklesIcon className="mt-0.5 size-4 shrink-0" />
                  Pregunta en català. Si ets en un detall (projecte, client…),
                  l&apos;agent el tindrà en compte. Adjunta factures amb el
                  clip.
                </p>
                <div className="flex flex-col gap-2">
                  {EXAMPLES.map((ex) => (
                    <Button
                      key={ex}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start whitespace-normal px-3 py-2 text-left font-normal"
                      disabled={busy}
                      onClick={() => void submit(ex)}
                    >
                      {ex}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const text = messageText(m.parts)
              const files = messageFiles(m.parts)
              const tools = hasToolActivity(m.parts)
              if (!text && !tools && !files.length) return null
              const isUser = m.role === "user"
              return (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    isUser
                      ? "ml-6 bg-primary text-primary-foreground"
                      : "mr-6 bg-muted text-foreground"
                  )}
                >
                  {!isUser && tools && !text && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Loader2Icon className="size-3.5 animate-spin" />
                      Treballant…
                    </p>
                  )}
                  {files.length > 0 && (
                    <div className={cn("mb-2 flex flex-col gap-2", text && "mb-2")}>
                      {files.map((f, i) =>
                        f.mediaType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${m.id}-file-${i}`}
                            src={f.url}
                            alt={f.filename ?? "adjunt"}
                            className="max-h-40 max-w-full rounded-md border border-border/40 object-contain"
                          />
                        ) : (
                          <a
                            key={`${m.id}-file-${i}`}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs",
                              isUser
                                ? "border-primary-foreground/30 text-primary-foreground"
                                : "border-border text-foreground"
                            )}
                          >
                            <FileIcon className="size-3.5 shrink-0" />
                            <span className="truncate">{f.filename ?? "Arxiu"}</span>
                          </a>
                        )
                      )}
                    </div>
                  )}
                  {text ? (
                    isUser ? (
                      <span className="whitespace-pre-wrap">{text}</span>
                    ) : (
                      <AgentMarkdown>{text}</AgentMarkdown>
                    )
                  ) : null}
                  {!isUser && tools && text && busy && m === messages[messages.length - 1] && (
                    <Loader2Icon className="mt-1 size-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
              )
            })}

            {(uploading ||
              (status === "submitted" || status === "streaming") &&
                messages.at(-1)?.role === "user") && (
              <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                {uploading ? "Pujant arxius…" : "Pensant…"}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error.message || "No s'ha pogut completar la petició."}
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => clearError()}
                  >
                    D&apos;acord
                  </Button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            className="flex flex-col gap-2 border-t p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submit(input)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!busy) addFiles(e.dataTransfer.files)
            }}
          >
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs"
                  >
                    <FileIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{p.file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-5"
                      disabled={busy}
                      onClick={() =>
                        setPending((prev) => prev.filter((x) => x.id !== p.id))
                      }
                    >
                      <XIcon className="size-3" />
                      <span className="sr-only">Treu</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escriu una consulta o una acció… (o arrossega un arxiu)"
              rows={3}
              disabled={busy}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void submit(input)
                }
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={INVOICE_FILE_TYPES.join(",")}
              multiple
              disabled={busy}
              onChange={(e) => addFiles(e.target.files)}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || pending.length >= 5}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PaperclipIcon className="size-4" />
                  Adjunta
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={messages.length === 0 || busy}
                  onClick={() => {
                    setMessages([])
                    setPending([])
                    clearError()
                  }}
                >
                  Neteja
                </Button>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={busy || (!input.trim() && pending.length === 0)}
              >
                {busy ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SendIcon className="size-4" />
                )}
                Envia
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
