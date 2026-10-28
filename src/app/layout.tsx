import type { Metadata } from "next"
import { Roboto } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
})

export const metadata: Metadata = {
  title: { default: "Fundipau · Gestió", template: "%s · Fundipau" },
  description: "Gestió de projectes, clients, factures i nòmines",
  icons: { icon: "/logo.svg" },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ca" className={`${roboto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
