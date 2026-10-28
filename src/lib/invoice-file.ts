/** Prefix dels arxius de factura al Blob store privat */
export const INVOICE_FILE_PREFIX = "invoices/"

/** Mida màxima d'un arxiu de factura (20 MB) */
export const INVOICE_FILE_MAX_BYTES = 20 * 1024 * 1024

export const INVOICE_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export function isInvoiceFilePathname(pathname: string): boolean {
  return pathname.startsWith(INVOICE_FILE_PREFIX) && !pathname.includes("..")
}

/** URL de l'app per descarregar un arxiu privat (requereix sessió) */
export function invoiceFileHref(pathname: string): string {
  return `/api/invoices/file?pathname=${encodeURIComponent(pathname)}`
}
