import "server-only"

import nodemailer from "nodemailer"

type SendMailInput = {
  to: string
  subject: string
  text: string
  html: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable d'entorn ${name}`)
  return value
}

function createTransport() {
  // 465 = SSL implícit; 587 = STARTTLS (requireTLS). Mai plain text.
  const port = Number(process.env.SMTP_PORT ?? "465")
  const useImplicitSsl = port === 465
  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port,
    secure: useImplicitSsl,
    requireTLS: !useImplicitSsl,
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
    tls: {
      minVersion: "TLSv1.2",
    },
  })
}

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  )
}

export async function sendMail(input: SendMailInput) {
  const transport = createTransport()
  await transport.sendMail({
    from: requireEnv("SMTP_FROM"),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}

export async function sendPasswordResetEmail({
  to,
  name,
  url,
}: {
  to: string
  name?: string | null
  url: string
}) {
  const greeting = name?.trim() ? `Hola ${name.trim()},` : "Hola,"
  const subject = "Restableix la teva contrasenya — Fundipau"
  const text = [
    greeting,
    "",
    "Has demanat restablir la contrasenya del compte de gestió de Fundipau.",
    "Obre aquest enllaç per triar-ne una de nova (caduca en 1 hora):",
    url,
    "",
    "Si no has fet aquesta petició, pots ignorar aquest correu.",
  ].join("\n")

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5; color: #282828;">
      <p>${greeting}</p>
      <p>Has demanat restablir la contrasenya del compte de gestió de <strong>Fundipau</strong>.</p>
      <p>
        <a href="${url}" style="display:inline-block;background:#006eb6;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
          Restablir la contrasenya
        </a>
      </p>
      <p style="color:#555;font-size:14px;">L’enllaç caduca en 1 hora. Si no has fet aquesta petició, ignora aquest correu.</p>
      <p style="color:#888;font-size:12px;word-break:break-all;">${url}</p>
    </div>
  `

  await sendMail({ to, subject, text, html })
}

export async function sendInviteEmail({
  to,
  inviterName,
  url,
}: {
  to: string
  inviterName?: string | null
  url: string
}) {
  const who = inviterName?.trim() || "Algú de l'equip"
  const subject = "T’han convidat a Fundipau"
  const text = [
    "Hola,",
    "",
    `${who} t’ha convidat a la gestió pressupostària de projectes de Fundipau.`,
    "Obre aquest enllaç per crear el teu compte (caduca en 7 dies):",
    url,
    "",
    "Si no esperaves aquesta invitació, pots ignorar aquest correu.",
  ].join("\n")

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5; color: #282828;">
      <p>Hola,</p>
      <p><strong>${who}</strong> t’ha convidat a la gestió pressupostària de projectes de <strong>Fundipau</strong>.</p>
      <p>
        <a href="${url}" style="display:inline-block;background:#006eb6;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
          Crear el compte
        </a>
      </p>
      <p style="color:#555;font-size:14px;">L’enllaç caduca en 7 dies. Si no esperaves aquesta invitació, ignora aquest correu.</p>
      <p style="color:#888;font-size:12px;word-break:break-all;">${url}</p>
    </div>
  `

  await sendMail({ to, subject, text, html })
}
