"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react"

type InvoiceListNav = {
  pending: boolean
  replace: (href: string) => void
  setParam: (key: string, value: string) => void
  replaceParams: (mutate: (sp: URLSearchParams) => void) => void
}

const InvoiceListNavContext = createContext<InvoiceListNav | null>(null)

function hrefOf(pathname: string, params: URLSearchParams) {
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export function InvoiceListNavProvider({
  children,
  dataKey,
}: {
  children: ReactNode
  /** Canvia quan arriben dades noves del servidor (p. ex. ids de factures). */
  dataKey: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, start] = useTransition()
  const [pending, setPending] = useState(false)
  const targetHref = useRef<string | null>(null)
  const currentHref = hrefOf(pathname, params)

  // Quan la URL coincideix amb la navegació demanada, o arriben dades noves, deixa de carregar.
  useEffect(() => {
    if (!pending) return
    if (targetHref.current === null || targetHref.current === currentHref) {
      targetHref.current = null
      setPending(false)
    }
  }, [currentHref, dataKey, pending])

  // Si la navegació falla (error de servidor, etc.), no deixis l'spinner penjat.
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => {
      targetHref.current = null
      setPending(false)
    }, 12_000)
    return () => clearTimeout(t)
  }, [pending])

  const replace = (href: string) => {
    if (href === currentHref) return
    targetHref.current = href
    setPending(true)
    start(() => {
      router.replace(href, { scroll: false })
    })
  }

  const replaceParams = (mutate: (sp: URLSearchParams) => void) => {
    const sp = new URLSearchParams(params)
    mutate(sp)
    replace(hrefOf(pathname, sp))
  }

  const setParam = (key: string, value: string) => {
    replaceParams((sp) => {
      if (value) sp.set(key, value)
      else sp.delete(key)
    })
  }

  return (
    <InvoiceListNavContext.Provider value={{ pending, replace, setParam, replaceParams }}>
      {children}
    </InvoiceListNavContext.Provider>
  )
}

export function useInvoiceListNav() {
  const ctx = useContext(InvoiceListNavContext)
  if (!ctx) throw new Error("useInvoiceListNav must be used within InvoiceListNavProvider")
  return ctx
}
