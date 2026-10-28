import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { INVOICE_FILE_MAX_BYTES, INVOICE_FILE_PREFIX, INVOICE_FILE_TYPES } from "@/lib/invoice-file"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session) throw new Error("No autenticat")
        if (!pathname.startsWith(INVOICE_FILE_PREFIX)) {
          throw new Error("Pathname no permès")
        }

        return {
          allowedContentTypes: [...INVOICE_FILE_TYPES],
          maximumSizeInBytes: INVOICE_FILE_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        }
      },
      onUploadCompleted: async () => {
        // La factura desa el pathname al guardar el formulari (el callback no sempre arriba en local).
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
