"use client"

import * as React from "react"

import { AgentSheet } from "@/components/agent/agent-sheet"

type AgentContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const AgentContext = React.createContext<AgentContextValue | null>(null)

export function useAgentPanel() {
  const ctx = React.useContext(AgentContext)
  if (!ctx) {
    throw new Error("useAgentPanel s'ha d'usar dins d'AgentProvider")
  }
  return ctx
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((v) => !v),
    }),
    [open]
  )

  return (
    <AgentContext.Provider value={value}>
      {children}
      <AgentSheet open={open} onOpenChange={setOpen} />
    </AgentContext.Provider>
  )
}
