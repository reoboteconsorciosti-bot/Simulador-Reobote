import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/auth-context"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Simulador de Consórcios | Compare e Escolha a Melhor Opção",
  description:
    "Simulador completo de consórcios com comparação entre consórcio, financiamento, à vista e outras modalidades",
  generator: "v0.app",
  icons: {
    icon: "/Frame 2.svg",
    shortcut: "/Frame 2.svg",
    apple: "/Frame 2.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
