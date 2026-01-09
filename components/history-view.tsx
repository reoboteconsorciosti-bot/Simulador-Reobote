"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { useAuth } from "@/components/auth-context"
import { UserRole } from "@/lib/auth-types"
import { formatCurrency } from "@/lib/formatters"

type ApiUser = {
  id: string
  name: string
  email: string
  role: string
  teamId: string | null
}

type SimulationItem = {
  id: string
  createdAt: string
  inputs: any
  outputs: any
  user: ApiUser
}

type SimulationsResponse = {
  items: SimulationItem[]
  nextCursor: string | null
}

function getCreatedAtLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("pt-BR")
}

function inferTipo(inputs: any) {
  const tipoSimulacao = inputs?.tipoSimulacao
  if (typeof tipoSimulacao === "string") return tipoSimulacao
  if (inputs?.taxaFinanciamento != null || inputs?.entrada != null) return "financiamento"
  return "consorcio"
}

function inferValorBem(inputs: any) {
  const credito = inputs?.credito
  if (typeof credito === "number") return credito
  const valorBemNumero = inputs?.valorBemNumero
  if (typeof valorBemNumero === "number") return valorBemNumero
  const valorBem = inputs?.valorBem
  if (typeof valorBem === "number") return valorBem
  return null
}

function inferParcela(outputs: any) {
  const v =
    outputs?.simulacaoOficial?.valorParcela ??
    outputs?.valorParcela ??
    outputs?.parcelaMensal ??
    outputs?.consorcio?.parcelaMensal ??
    outputs?.financiamento?.parcelaMensal ??
    outputs?.aVista?.parcelaMensal
  if (typeof v === "number") return v
  return null
}

function inferTipoBem(inputs: any): "imovel" | "automovel" | null {
  if (!inputs || typeof inputs !== "object") return null
  const raw = (inputs as any).tipoBem
  if (raw === "imovel" || raw === "automovel") return raw
  return null
}

function inferNomeCliente(inputs: any): string | null {
  if (!inputs || typeof inputs !== "object") return null
  const direto = (inputs as any).nomeCliente
  if (typeof direto === "string" && direto.trim()) return direto.trim()
  const legado = (inputs as any).clienteNome
  if (typeof legado === "string" && legado.trim()) return legado.trim()
  return null
}

function inferNomeConsultor(inputs: any, owner: ApiUser | undefined): string | null {
  if (inputs && typeof inputs === "object") {
    const direto = (inputs as any).nomeConsultor
    if (typeof direto === "string" && direto.trim()) return direto.trim()
    const legado = (inputs as any).consultorNome
    if (typeof legado === "string" && legado.trim()) return legado.trim()
  }
  if (owner?.name && owner.name.trim()) return owner.name.trim()
  return null
}

function isConsorcioSimulation(inputs: any, outputs: any) {
  if (outputs?.simulacaoOficial != null) return true
  const tipoSimulacao = inputs?.tipoSimulacao
  if (tipoSimulacao === "consorcio") return true
  if (tipoSimulacao === "financiamento") return false
  if (inputs?.taxaFinanciamento != null || inputs?.entrada != null) return false
  return true
}

export function HistoryView() {
  const { user } = useAuth()
  const [items, setItems] = useState<SimulationItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterNomeCliente, setFilterNomeCliente] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmKind, setConfirmKind] = useState<"remove" | "clear" | null>(null)
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)

  const canSeeOwnerColumn =
    user?.profile.role === UserRole.Admin || user?.profile.role === UserRole.Gerente || user?.profile.role === UserRole.Supervisor

  const load = async (mode: "reset" | "more") => {
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const params = new URLSearchParams()
      // modo ilimitado: sempre traz todo o histórico disponível para o usuário
      params.set("take", "all")
      // em modo ilimitado, cursor deixa de fazer sentido; ignoramos nextCursor aqui

      const res = await fetch(`/api/simulations?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as SimulationsResponse | null

      if (!res.ok) {
        setError((data as any)?.message || "Não foi possível carregar o histórico.")
        return
      }

      const newItems = data?.items ?? []

      // Como o backend devolve tudo em modo ilimitado, sempre substituímos a lista inteira
      setItems(newItems)
      setNextCursor(null)
    } catch (e) {
      setError("Não foi possível carregar o histórico.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!confirmOpen) return

    const previousOverflow = typeof document !== "undefined" ? document.body.style.overflow : ""
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden"
    }

    const t = typeof window !== "undefined" ? window.setTimeout(() => confirmButtonRef.current?.focus(), 0) : null

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirm()
    }

    if (typeof window !== "undefined") window.addEventListener("keydown", onKeyDown)

    return () => {
      if (t != null && typeof window !== "undefined") window.clearTimeout(t)
      if (typeof window !== "undefined") window.removeEventListener("keydown", onKeyDown)
      if (typeof document !== "undefined") document.body.style.overflow = previousOverflow
    }
  }, [confirmOpen])

  const clearHistory = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/simulations`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError((data as any)?.message || "Não foi possível limpar o histórico.")
        return
      }

      setItems([])
      setNextCursor(null)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sim-pro-simulation-saved"))
      }
    } catch {
      setError("Não foi possível limpar o histórico.")
    } finally {
      setLoading(false)
    }
  }

  const removeSimulation = async (id: string) => {
    try {
      const res = await fetch(`/api/simulations?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError((data as any)?.message || "Não foi possível remover a simulação.")
        return
      }

      setItems((prev) => prev.filter((it) => it.id !== id))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sim-pro-simulation-saved"))
      }
    } catch {
      setError("Não foi possível remover a simulação.")
    }
  }

  const openConfirmClear = () => {
    setConfirmKind("clear")
    setConfirmTargetId(null)
    setConfirmOpen(true)
  }

  const openConfirmRemove = (id: string) => {
    setConfirmKind("remove")
    setConfirmTargetId(id)
    setConfirmOpen(true)
  }

  const closeConfirm = () => {
    setConfirmOpen(false)
    setConfirmKind(null)
    setConfirmTargetId(null)
  }

  const confirmAction = async () => {
    if (loading) return
    const kind = confirmKind
    const id = confirmTargetId
    closeConfirm()
    if (kind === "clear") {
      await clearHistory()
      return
    }
    if (kind === "remove" && id) {
      await removeSimulation(id)
    }
  }

  useEffect(() => {
    if (!user) return
    load("reset")

    const handler = () => load("reset")
    window.addEventListener("sim-pro-simulation-saved", handler)

    return () => {
      window.removeEventListener("sim-pro-simulation-saved", handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  const rows = useMemo(() => {
    const base = items.filter((it) => isConsorcioSimulation(it.inputs, it.outputs)).map((it) => {
      const tipoBem = inferTipoBem(it.inputs)
      const valorBem = inferValorBem(it.inputs)
      const parcela = inferParcela(it.outputs)
      const nomeCliente = inferNomeCliente(it.inputs)
      const nomeConsultor = inferNomeConsultor(it.inputs, it.user)
      return {
        id: it.id,
        createdAt: getCreatedAtLabel(it.createdAt),
        tipo:
          tipoBem === "imovel"
            ? "Imóvel"
            : tipoBem === "automovel"
              ? "Automóvel"
              : "-",
        valorBem,
        parcela,
        owner: it.user,
        nomeCliente,
        nomeConsultor,
        inputs: it.inputs,
        outputs: it.outputs,
      }
    })
    if (!filterNomeCliente.trim()) return base
    const term = filterNomeCliente.trim().toLowerCase()
    return base.filter((row) => row.nomeCliente?.toLowerCase().includes(term))
  }, [items, filterNomeCliente])

  if (!user) {
    return (
      <div className="rounded-xl bg-white/90 p-6 text-sm text-slate-600 shadow-sm">Faça login para ver o histórico.</div>
    )
  }

  return (
    <div className="rounded-xl bg-white/90 p-4 sm:p-6 shadow-sm">
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            key="confirm-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeConfirm()
            }}
          >
            <motion.div
              key="confirm-panel"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              initial={{ opacity: 0, scale: 0.98, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-slate-900">
                {confirmKind === "clear" ? "Remover histórico" : "Remover simulação"}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {confirmKind === "clear" ? "Remover TODO o histórico?" : "Remover esta simulação do histórico?"}
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={confirmAction}
                  className="rounded-lg border border-red-200 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Histórico</h2>
          <p className="mt-1 text-sm text-slate-500">Simulações salvas e acessíveis conforme seu perfil.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={filterNomeCliente}
            onChange={(e) => setFilterNomeCliente(e.target.value)}
            placeholder="Filtrar por nome do cliente"
            className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
          />
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openConfirmClear}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || rows.length === 0}
            title={rows.length === 0 ? "Nenhuma simulação para remover" : ""}
          >
            Limpar histórico
          </button>

          <button
            type="button"
            onClick={() => load("reset")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Data</th>
              <th className="px-3 py-2 text-left font-semibold">Cliente</th>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">Valor do bem</th>
              <th className="px-3 py-2 text-left font-semibold">Parcela</th>
              {canSeeOwnerColumn && <th className="px-3 py-2 text-left font-semibold">Consultor</th>}
              <th className="px-3 py-2 text-left font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 && !loading ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={canSeeOwnerColumn ? 7 : 6}>
                  Nenhuma simulação encontrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700">{row.createdAt}</td>
                  <td className="px-3 py-2 text-slate-700">{row.nomeCliente ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.tipo}</td>
                  <td className="px-3 py-2 text-slate-700">{row.valorBem != null ? formatCurrency(row.valorBem) : "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.parcela != null ? `${formatCurrency(row.parcela)}/mês` : "-"}</td>
                  {canSeeOwnerColumn && (
                    <td className="px-3 py-2 text-slate-700">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{row.nomeConsultor ?? row.owner?.name ?? "-"}</div>
                        <div className="truncate text-xs text-slate-500">{row.owner?.email ?? ""}</div>
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window === "undefined") return
                        try {
                          window.localStorage.setItem("sim-pro-reload-in-progress", "1")
                          window.localStorage.setItem(
                            "sim-pro-reload-simulation",
                            JSON.stringify({ inputs: row.inputs, outputs: row.outputs }),
                          )
                          window.dispatchEvent(
                            new CustomEvent("sim-pro-load-simulation", {
                              detail: { inputs: row.inputs, outputs: row.outputs },
                            }),
                          )
                          window.dispatchEvent(new Event("sim-pro-go-simulator"))
                        } catch {
                          // ignora
                        }
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Recarregar
                    </button>

                    <button
                      type="button"
                      onClick={() => openConfirmRemove(row.id)}
                      className="ml-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">Mostrando {rows.length} item(ns)</div>
        {nextCursor && (
          <button
            type="button"
            onClick={() => load("more")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Carregando..." : "Carregar mais"}
          </button>
        )}
      </div>
    </div>
  )
}
