"use client"

import { AppShell } from "@/components/app-shell"
import { LoginScreen } from "@/components/login-screen"
import { SimuladorConsorcio } from "@/components/simulador-consorcio"
import { useAuth } from "@/components/auth-context"

export function AppRoot() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white/90 p-8 shadow-xl text-center">
          <img
            src="/images/brand-arrow.png"
            alt=""
            className="mx-auto mb-3 h-24 w-auto object-contain"
          />
          <p className="text-sm text-slate-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <AppShell>
      <SimuladorConsorcio />
    </AppShell>
  )
}
