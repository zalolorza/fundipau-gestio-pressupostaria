import { Badge } from "@/components/ui/badge"
import { parseFunderKey } from "@/lib/funders"

/** Nom del finançador; badge «Subvenció» només quan el finançador és una subvenció. */
export function FunderOptionLabel({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const kind = parseFunderKey(id)?.kind
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="truncate">{name}</span>
      {kind === "subsidy" ? (
        <Badge variant="outline">Subvenció</Badge>
      ) : null}
    </span>
  )
}
