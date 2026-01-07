"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import type { User } from "@/lib/auth-types"
import { UserRole } from "@/lib/auth-types"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" })
    if (!response.ok) {
      setUser(null)
      return
    }
    const data = (await response.json().catch(() => null)) as { user?: User } | null
    setUser(data?.user ?? null)
  }

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (response.ok) {
          const data = (await response.json().catch(() => null)) as { user?: User } | null
          if (!cancelled && data?.user) {
            setUser(data.user)
            setLoading(false)
            return
          }
        }
      } catch {
        // ignora e tenta fallback local
      }

      if (!cancelled) setLoading(false)
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email: string, password: string) => {
    // Login fictício para ambiente sem backend:
    // se usar estas credenciais, não chama API e cria um usuário mockado.
    if (email === "teste@reobote.com" && password === "123456") {
      const mockUser: User = {
        uid: "mock-user-1",
        email,
        profile: {
          name: "Usuário de Teste",
          role: UserRole.Admin,
          teamId: "Geral",
          photoUrl: `https://api.dicebear.com/7.x/initials/svg?seed=TesteReobote`,
        },
      }

      try {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: mockUser }),
        })
      } catch {
        // ignora
      }

      setUser(mockUser)
      return
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.message || "Falha no login. Verifique suas credenciais.")
    }

    setUser(data.user)
  }

  const logout = () => {
    try {
      fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignora
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sim-pro-user")
      window.localStorage.removeItem("sim-pro-token")
      window.localStorage.removeItem("sim-pro-current-view")
    }
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
