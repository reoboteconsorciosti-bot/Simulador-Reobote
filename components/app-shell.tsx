"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/components/auth-context"
import { AdminView } from "@/components/admin-view"
import { HistoryView } from "@/components/history-view"
import { InsightsView } from "@/components/insights-view"
import { UserRole } from "@/lib/auth-types"
import { BarChart3, Clock, Home, Shield, ChevronLeft, ChevronRight, Menu } from "lucide-react"

type AppTab = "simulator" | "history" | "insights" | "admin"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth()
  const [currentTab, setCurrentTab] = useState<AppTab>("simulator")
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isDesktop, setIsDesktop] = useState<boolean>(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = () => setCurrentTab("simulator")
    window.addEventListener("sim-pro-go-simulator", handler)
    return () => window.removeEventListener("sim-pro-go-simulator", handler)
  }, [])

  // Detecta se é desktop (>= 1024px) para definir comportamento padrão da sidebar
  useEffect(() => {
    if (typeof window === "undefined") return

    const mq = window.matchMedia("(min-width: 1024px)")

    const updateIsDesktop = () => {
      setIsDesktop(mq.matches)
    }

    updateIsDesktop()
    mq.addEventListener("change", updateIsDesktop)

    return () => mq.removeEventListener("change", updateIsDesktop)
  }, [])

  // Em desktop a sidebar fica aberta por padrão; em telas menores começa fechada
  useEffect(() => {
    setIsOpen(isDesktop)
  }, [isDesktop])

  useEffect(() => {
    if (!isProfileMenuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current) return
      if (profileMenuRef.current.contains(event.target as Node)) return
      setIsProfileMenuOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsProfileMenuOpen(false)
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [isProfileMenuOpen])

  const canSeeInsights =
    user?.profile.role === UserRole.Admin ||
    user?.profile.role === UserRole.Gerente ||
    user?.profile.role === UserRole.Supervisor ||
    user?.profile.role === UserRole.Consultor

  const canSeeAdmin = user?.profile.role === UserRole.Admin

  const handleChangeTab = (tab: AppTab) => {
    setCurrentTab(tab)
  }

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      {/* Botão fixo de abertura/fechamento da sidebar - apenas em mobile/tablet */}
      {!isDesktop && (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`fixed top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 ${
            isOpen ? "left-60" : "left-4"
          }`}
          aria-label="Alternar menu lateral"
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      )}

      {/* Barra lateral esquerda responsiva */}
      <aside className="pointer-events-auto flex-shrink-0">
        <div
          className={`sidebar transform-gpu border-r border-slate-200 bg-white/95 shadow-lg transition-all duration-300 ease-out ${
            isDesktop
              ? // Desktop: sidebar participa do layout em coluna
                `${isOpen ? "w-56" : "w-16"} relative h-screen`
              : // Mobile/Tablet: sidebar fixa sobrepondo o conteúdo
                `${isOpen ? "fixed inset-y-0 left-0 w-56 z-40" : "fixed inset-y-0 -left-full w-56 z-40"}`
          }`}
        >
          <div className="flex w-full flex-col h-screen overflow-y-auto lg:sticky lg:top-6 pt-6">
            {/* Cabeçalho da barra com logo compacto e botão de toggle */}
            <div className="flex items-center justify-between px-2 py-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="truncate text-base font-semibold text-slate-900">
                  {isOpen ? "Reobote Consórcios" : "Reobote"}
                </span>
              </div>
              {/* Em desktop, botão de toggle alinhado à direita do container */}
              {isDesktop && (
                <button
                  type="button"
                  onClick={() => setIsOpen((prev) => !prev)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
                  aria-label="Alternar menu lateral"
                >
                  {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              )}
            </div>

            {/* Navegação principal */}
            <nav className="mt-4 flex-1 space-y-1 px-1">
              <SidebarItem
                active={currentTab === "simulator"}
                icon={<Home className="h-4 w-4" />}
                label="Simulador"
                isOpen={isOpen}
                onClick={() => handleChangeTab("simulator")}
              />

              <SidebarItem
                active={currentTab === "history"}
                icon={<Clock className="h-4 w-4" />}
                label="Histórico"
                isOpen={isOpen}
                onClick={() => handleChangeTab("history")}
              />

              {canSeeInsights && (
                <SidebarItem
                  active={currentTab === "insights"}
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Insights"
                  isOpen={isOpen}
                  onClick={() => handleChangeTab("insights")}
                />
              )}

              {canSeeAdmin && (
                <SidebarItem
                  active={currentTab === "admin"}
                  icon={<Shield className="h-4 w-4" />}
                  label="Admin"
                  isOpen={isOpen}
                  onClick={() => handleChangeTab("admin")}
                />
              )}
            </nav>

            {/* Rodapé com usuário e botão sair */}
            {user && (
              <div className="border-t border-slate-200 px-2 py-3 text-xs text-slate-600">
                <div className="flex items-center gap-2 pr-1">
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                      className="rounded-full"
                      aria-label="Abrir menu do perfil"
                    >
                      <img
                        src={
                          user.profile.photoUrl ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${user.profile.name.replace(/\s/g, "")}`
                        }
                        alt={user.profile.name}
                        className="h-7 w-7 flex-shrink-0 rounded-full object-cover border border-slate-200"
                      />
                    </button>

                    {isProfileMenuOpen && (
                      <div className="absolute bottom-10 left-0 z-50 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false)
                            logout()
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Sair
                        </button>
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">{user.profile.name}</div>
                      <div className="truncate text-[11px] text-slate-500">{user.profile.role}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Conteúdo principal ocupando toda a faixa entre a sidebar e a borda direita */}
      <main className="flex-1 min-w-0 overflow-y-auto scroll-smooth px-3 sm:px-6 py-4 sm:py-6">
        <div className="w-full">
          {currentTab === "simulator" && children}

          {currentTab === "history" && (
            <HistoryView />
          )}

          {currentTab === "insights" && (
            <InsightsView />
          )}

          {currentTab === "admin" && (
            <AdminView />
          )}
        </div>
      </main>
    </div>
  )
}

interface SidebarItemProps {
  active: boolean
  icon: ReactNode
  label: string
  isOpen: boolean
  onClick: () => void
}

function SidebarItem({ active, icon, label, isOpen, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-blue-50 text-blue-600"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          active ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        <span className="scale-110">{icon}</span>
      </span>
      {isOpen && <span className="text-base">{label}</span>}
    </button>
  )
}
