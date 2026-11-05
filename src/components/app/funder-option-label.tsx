import { Badge } from "@/components/ui/badge"
import { parseFunderKey } from "@/lib/funders"

/** Nom del finançador amb badge «Finançador» o «Subvenció». */
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
      ) : kind === "client" ? (
        <Badge variant="outline">Finançador</Badge>
      ) : null}
    </span>
  )
}
