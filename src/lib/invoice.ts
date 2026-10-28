import { round2 } from "./format"

/** Calcula els imports d'una factura a partir de la base i els tipus */
export function computeInvoice(base: number, vatRate: number, irpfRate: number) {
  const vatAmount = round2((base * vatRate) / 100)
  const irpfAmount = round2((base * irpfRate) / 100)
  const total = round2(base + vatAmount - irpfAmount)
  return { vatAmount, irpfAmount, total }
}

/**
 * Cost imputable d'una factura: base + IVA.
 * L'IRPF és una retenció que igualment es paga (a Hisenda), per tant no redueix el cost.
 */
export function invoiceCost(inv: { baseAmount: number; vatAmount: number }) {
  return round2(inv.baseAmount + inv.vatAmount)
}

export const VAT_RATES = [21, 10, 4, 0]
export const IRPF_RATES = [0, 7, 15, 19]
