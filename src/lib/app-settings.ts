import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { appSettings } from "@/db/schema"
import { DEFAULT_VAT_DEDUCTIBLE_RATE } from "@/lib/invoice"
import { maskSecret, openSecret, sealSecret } from "@/lib/secret-box"

export const SETTING_ANTHROPIC_API_KEY = "anthropic_api_key"
export const SETTING_VAT_DEDUCTIBLE_RATE = "vat_deductible_rate"

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, key),
    columns: { value: true },
  })
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    })
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key))
}

export async function getAnthropicApiKey(): Promise<string | null> {
  const sealed = await getSetting(SETTING_ANTHROPIC_API_KEY)
  if (!sealed) return null
  try {
    return openSecret(sealed)
  } catch (e) {
    console.error("No s'ha pogut desxifrar la clau d'Anthropic", e)
    return null
  }
}

export async function setAnthropicApiKey(apiKey: string): Promise<void> {
  await setSetting(SETTING_ANTHROPIC_API_KEY, sealSecret(apiKey.trim()))
}

export async function clearAnthropicApiKey(): Promise<void> {
  await deleteSetting(SETTING_ANTHROPIC_API_KEY)
}

/** Metadades públiques per a la UI (mai la clau en clar). */
export async function getAnthropicApiKeyStatus(): Promise<{
  configured: boolean
  hint: string | null
}> {
  const key = await getAnthropicApiKey()
  if (!key) return { configured: false, hint: null }
  return { configured: true, hint: maskSecret(key) }
}

/** % d'IVA deduïble per defecte a les factures noves (0–100). */
export async function getDefaultVatDeductibleRate(): Promise<number> {
  const raw = await getSetting(SETTING_VAT_DEDUCTIBLE_RATE)
  if (raw == null) return DEFAULT_VAT_DEDUCTIBLE_RATE
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_VAT_DEDUCTIBLE_RATE
  return n
}

export async function setDefaultVatDeductibleRate(rate: number): Promise<void> {
  await setSetting(SETTING_VAT_DEDUCTIBLE_RATE, String(rate))
}
