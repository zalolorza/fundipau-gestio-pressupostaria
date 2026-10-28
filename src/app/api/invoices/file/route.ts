import { del, get } from "@vercel/blob"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

import { db } from "@/db"
import { supplierInvoices } from "@/db/schema"
import { auth } from "@/lib/auth"
import { isInvoiceFilePathname } from "@/lib/invoice-file"

async function requireApiSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  return session
}

export async function GET(request: NextRequest) {
  if (!(await requireApiSession())) {
    return NextResponse.json({ error: "No autenticat" }, { status: 401 })
  }

  const pathname = request.nextUrl.searchParams.get("pathname")
  if (!pathname || !isInvoiceFilePathname(pathname)) {
    return NextResponse.json({ error: "Pathname no vàlid" }, { status: 400 })
  }

  const [result, row] = await Promise.all([
    get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    }),
    db.query.supplierInvoices.findFirst({
      where: eq(supplierInvoices.filePathname, pathname),
      columns: { fileName: true },
    }),
  ])

  if (!result) {
    return new NextResponse("No trobat", { status: 404 })
  }

  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: result.headers.get("etag") ?? "",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    })
  }

  const fileName = row?.fileName ?? pathname.split("/").pop() ?? "factura"
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ...(result.blob.etag ? { ETag: result.blob.etag } : {}),
    },
  })
}

/** Elimina un arxiu orfe (p. ex. en cancel·lar després de pujar-ne un de nou) */
export async function DELETE(request: NextRequest) {
  if (!(await requireApiSession())) {
    return NextResponse.json({ error: "No autenticat" }, { status: 401 })
  }

  const pathname = request.nextUrl.searchParams.get("pathname")
  if (!pathname || !isInvoiceFilePathname(pathname)) {
    return NextResponse.json({ error: "Pathname no vàlid" }, { status: 400 })
  }

  await del(pathname)
  return NextResponse.json({ ok: true })
}
