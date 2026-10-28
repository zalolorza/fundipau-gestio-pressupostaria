import { z } from "zod"

export const extractedInvoiceSchema = z.object({
  number: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  supplierTaxId: z.string().nullable().optional(),
  supplierAddress: z.string().nullable().optional(),
  supplierPostalCode: z.string().nullable().optional(),
  supplierCity: z.string().nullable().optional(),
  baseAmount: z.number().nullable().optional(),
  vatRate: z.number().nullable().optional(),
  irpfRate: z.number().nullable().optional(),
})

export type ExtractedInvoiceFields = z.infer<typeof extractedInvoiceSchema>
