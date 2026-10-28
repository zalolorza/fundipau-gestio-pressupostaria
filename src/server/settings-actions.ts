"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  clearAnthropicApiKey,
  setAnthropicApiKey,
  setDefaultVatDeductibleRate,
} from "@/lib/app-settings"
import { requireAdmin } from "@/lib/auth"

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dades no vàlides" }
  console.error(e)
  return { ok: false, error: e instanceof Error ? e.message : "S'ha produït un error" }
}

const apiKeySchema = z
  .string()
  .trim()
  .min(20, "La clau sembla massa curta")
  .refine((v) => v.startsWith("sk-ant-"), "La clau d'Anthropic ha de començar per sk-ant-")

const vatDeductibleRateSchema = z.coerce
  .number()
  .min(0, "El percentatge ha de ser entre 0 i 100")
  .max(100, "El percentatge ha de ser entre 0 i 100")

export async function saveAnthropicApiKey(apiKey: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    const key = apiKeySchema.parse(apiKey)
    await setAnthropicApiKey(key)
    revalidatePath("/ajustos")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function removeAnthropicApiKey(): Promise<ActionResult> {
  await requireAdmin()
  try {
    await clearAnthropicApiKey()
    revalidatePath("/ajustos")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function saveDefaultVatDeductibleRate(rate: number): Promise<ActionResult> {
  await requireAdmin()
  try {
    const value = vatDeductibleRateSchema.parse(rate)
    await setDefaultVatDeductibleRate(value)
    revalidatePath("/ajustos")
    revalidatePath("/factures")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
