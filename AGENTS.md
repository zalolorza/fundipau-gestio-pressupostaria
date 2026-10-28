<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI: prioritza sempre shadcn/ui

Aquest projecte usa **shadcn/ui** (`style: radix-nova` a `components.json`). En qualsevol UI nova o canvi visual:

1. **Reutilitza** primers els components de `src/components/ui/*` (`Button`, `Input`, `Field`, `Dialog`, `Select`, `Table`, `Card`, `Badge`, `Tabs`, `AlertDialog`, `Sidebar`, etc.).
2. Si falta un component, **afegeix-lo amb la CLI** abans d’inventar-ne un de nou:
   ```bash
   yarn dlx shadcn@latest add <component>
   ```
3. **No** implementis `<button>`, `<input>`, `<select>`, `<textarea>`, diàlegs o taules natius amb estils manuals quan existeixi un equivalent shadcn.
4. Els components de domini (`src/components/app|…`) han de **compondre** primitives shadcn; no reinventar botons, camps ni overlays.
5. Importa des de `@/components/ui/…` i `cn` des de `@/lib/utils` al codi d’aplicació. No creïs un sistema de design paral·lel.
