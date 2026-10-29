"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

export function AgentMarkdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "agent-md text-sm leading-relaxed break-words",
        "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
        "[&_p]:my-2",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4",
        "[&_li]:leading-snug",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_code]:rounded-sm [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background/60 [&_pre]:p-2 [&_pre]:text-[0.85em]",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_hr]:my-3 [&_hr]:border-border",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:bg-background/50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top",
        "[&_tr:nth-child(even)_td]:bg-background/30",
        className
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {linkChildren}
            </a>
          ),
          table: ({ children: tableChildren }) => (
            <div className="my-2 max-w-full overflow-x-auto">
              <table>{tableChildren}</table>
            </div>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}
