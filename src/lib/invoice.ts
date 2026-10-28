import { round2 } from "./format"

/** Calcula els imports d'una factura a partir de la base i els tipus */
export function computeInvoice(base: number, vatRate: number, irpfRate: number) {
  const vatAmount = round2((base * vatRate) / 100)
  const irpfAmount = round2((base * irpfRate) / 100)
  const total = round2(base + vatAmount - irpfAmount)
  return { vatAmount, irpfAmount, total }
}

/** Import d'IVA deduïble: percentatge de l'IVA original de la factura. */
export function deductibleVatAmount(inv: { vatAmount: number; vatDeductibleRate: number }) {
  return round2((inv.vatAmount * inv.vatDeductibleRate) / 100)
}

/**
 * Cost imputable d'una factura: base + IVA deduïble.
 * L'IRPF és una retenció que igualment es paga (a Hisenda), per tant no redueix el cost.
 */
export function invoiceCost(inv: {
  baseAmount: number
  vatAmount: number
  vatDeductibleRate: number
}) {
  return round2(inv.baseAmount + deductibleVatAmount(inv))
}

export const VAT_RATES = [21, 10, 4, 0]

/** Valor per defecte si no hi ha cap ajust configurat. */
export const DEFAULT_VAT_DEDUCTIBLE_RATE = 100
