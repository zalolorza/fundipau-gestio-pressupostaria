export type AgentEntityType =
  | "project"
  | "client"
  | "invoice"
  | "supplier"
  | "payroll"

export type AgentPageContext = {
  pathname: string
  route: string
  entityType?: AgentEntityType
  entityId?: string
}

const DETAIL: { prefix: string; entityType: AgentEntityType }[] = [
  { prefix: "/projectes/", entityType: "project" },
  { prefix: "/clients/", entityType: "client" },
  { prefix: "/factures/", entityType: "invoice" },
  { prefix: "/proveidors/", entityType: "supplier" },
  { prefix: "/nomines/", entityType: "payroll" },
]

/** Parseja el pathname de l'app a un context mínim per a l'agent. */
export function parsePageContext(pathname: string): AgentPageContext {
  const path = (pathname || "/").split("?")[0] || "/"

  for (const { prefix, entityType } of DETAIL) {
    if (path.startsWith(prefix)) {
      const rest = path.slice(prefix.length)
      const entityId = rest.split("/")[0]
      if (entityId && /^[0-9a-f-]{36}$/i.test(entityId)) {
        return {
          pathname: path,
          route: prefix.slice(0, -1),
          entityType,
          entityId,
        }
      }
    }
  }

  if (path === "/" || path === "") {
    return { pathname: path || "/", route: "/" }
  }

  const top = "/" + path.split("/").filter(Boolean)[0]
  return { pathname: path, route: top }
}
