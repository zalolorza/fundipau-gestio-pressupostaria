import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/** Deriva una clau AES-256 a partir del secret de l'app (BETTER_AUTH_SECRET). */
function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("Falta BETTER_AUTH_SECRET per xifrar secrets")
  return createHash("sha256").update(secret).digest()
}

/** Xifra text amb AES-256-GCM. Format: `v1:<iv>:<tag>:<ciphertext>` (base64). */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`
}

/** Desxifra un valor creat amb `sealSecret`. */
export function openSecret(sealed: string): string {
  const [version, ivB64, tagB64, dataB64] = sealed.split(":")
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Format de secret no vàlid")
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

/** Mostra només els últims caràcters d'una clau (per a la UI d'admin). */
export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible) return "••••"
  return `••••${value.slice(-visible)}`
}
