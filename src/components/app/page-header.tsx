"use client"

import { MessageSquareIcon } from "lucide-react"
import Link from "next/link"
import { Fragment } from "react"

import { useAgentPanel } from "@/components/agent/agent-provider"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function PageHeader({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  const { toggle } = useAgentPanel()
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator className="hidden md:block" />}
              <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden md:block" : undefined}>
                {c.href && i < crumbs.length - 1 ? (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-auto shrink-0"
        onClick={toggle}
      >
        <MessageSquareIcon className="size-4" />
        <span className="hidden sm:inline">Agent</span>
      </Button>
    </header>
  )
}

export function PageTitle({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 pt-0 md:px-6">{children}</div>
}
