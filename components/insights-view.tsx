"use client"

import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/components/auth-context"
import { formatCurrency } from "@/lib/formatters"

type SimulationItem = {
  id: string
  createdAt: string
  inputs: any
  outputs: any
  user: { id: string; name: string; email: string; role: string; teamId: string | null }
}

type SimulationsResponse = {
  items: SimulationItem[]
  nextCursor: string | null
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

function inferTipoBem(inputs: any): "imovel" | "automovel" | null {
  if (!inputs || typeof inputs !== "object") return null

  const raw = (inputs as any).tipoBem
  if (raw === "imovel" || raw === "automovel") return raw

  if (typeof raw === "string") {
    const lower = raw.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    if (lower.includes("imovel")) return "imovel"
    if (lower.includes("auto")) return "automovel"
  }

  return null
}

function inferPrazoMeses(inputs: any) {
  if (!inputs || typeof inputs !== "object") return null

  const tipo = inferTipo(inputs)

  if (tipo === "financiamento") {
    const prazoFinNumero = inputs?.prazoMesesFinNumero
    if (typeof prazoFinNumero === "number" && Number.isFinite(prazoFinNumero) && prazoFinNumero > 0) return prazoFinNumero
    const prazoFin = inputs?.prazoMesesFin
    if (typeof prazoFin === "string" && prazoFin.trim() !== "") {
      const n = Number.parseInt(prazoFin.replace(/[^0-9]/g, ""), 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  const prazoNumero = inputs?.prazoMesesNumero
  if (typeof prazoNumero === "number" && Number.isFinite(prazoNumero) && prazoNumero > 0) return prazoNumero
  const prazo = inputs?.prazoMeses
  if (typeof prazo === "string" && prazo.trim() !== "") {
    const n = Number.parseInt(prazo.replace(/[^0-9]/g, ""), 10)
    if (Number.isFinite(n) && n > 0) return n
  }

  return null
}

function dayKey(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatDayLabel(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map((v) => Number(v))
  if (!y || !m || !d) return yyyyMmDd
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}
function RadialMetric(props: {
  label: string
  valueLabel: string
  value: number
  max: number
  accentColor: string
  subtleColor: string
}) {
  const { label, valueLabel, value, max, accentColor, subtleColor } = props
  const size = 148
  const strokeWidth = 16
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const normalized = Math.max(0, Math.min(1, max > 0 ? value / max : 0))
  const offset = circumference - normalized * circumference

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-900/5 p-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-[92px] w-[92px] drop-shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
      >
        <defs>
          <linearGradient id="radial-metric-accent" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.95} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={subtleColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#radial-metric-accent)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="space-y-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-900">{valueLabel}</div>
        <div className="text-[11px] text-slate-500">
          {(normalized * 100).toFixed(0)}% em relação ao pico recente
        </div>
      </div>
    </div>
  )
}

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function formatCompactValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0"
  return compactNumberFormatter.format(value)
}

export function InsightsView() {
  const { user } = useAuth()
  const [items, setItems] = useState<SimulationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consultantFilter, setConsultantFilter] = useState("")
  const [selectedConsultantId, setSelectedConsultantId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Carrega todo o histórico visível para o usuário (sem limite artificial de quantidade)
        const res = await fetch("/api/simulations?take=all", { cache: "no-store" })
        const data = (await res.json().catch(() => null)) as SimulationsResponse | null
        if (!res.ok) {
          setError((data as any)?.message || "Não foi possível carregar insights.")
          return
        }
        if (!cancelled) setItems(data?.items ?? [])
      } catch {
        setError("Não foi possível carregar insights.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    const handler = () => load()
    window.addEventListener("sim-pro-simulation-saved", handler)

    return () => {
      window.removeEventListener("sim-pro-simulation-saved", handler)
      cancelled = true
    }
  }, [user?.uid])

  const metrics = useMemo(() => {
    const total = items.length
    const byTipo = items.reduce(
      (acc, it) => {
        const tipo = inferTipo(it.inputs)
        acc[tipo] = (acc[tipo] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const valores = items
      .map((it) => inferValorBem(it.inputs))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)

    const somaValores = valores.reduce((a, b) => a + b, 0)
    const mediaValores = valores.length > 0 ? somaValores / valores.length : 0

    const prazos = items
      .map((it) => inferPrazoMeses(it.inputs))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)

    const somaPrazos = prazos.reduce((a, b) => a + b, 0)
    const prazoMedioMeses = prazos.length > 0 ? somaPrazos / prazos.length : 0

    const { totalImoveis, totalAutomoveis } = items.reduce(
      (acc, it) => {
        const tipoBem = inferTipoBem(it.inputs)
        if (tipoBem === "imovel") acc.totalImoveis += 1
        else if (tipoBem === "automovel") acc.totalAutomoveis += 1
        return acc
      },
      { totalImoveis: 0, totalAutomoveis: 0 },
    )

    const ultimos7Dias = (() => {
      const now = Date.now()
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      return items.filter((it) => {
        const t = new Date(it.createdAt).getTime()
        if (!Number.isFinite(t)) return false
        return now - t <= sevenDays
      }).length
    })()

    const series = (() => {
      const now = Date.now()
      const days = 14
      const start = now - (days - 1) * 24 * 60 * 60 * 1000

      const buckets = new Map<string, { count: number; sumValorBem: number; countValorBem: number }>()
      for (let i = 0; i < days; i++) {
        const d = new Date(start + i * 24 * 60 * 60 * 1000)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        buckets.set(key, { count: 0, sumValorBem: 0, countValorBem: 0 })
      }

      for (const it of items) {
        const key = dayKey(it.createdAt)
        if (!key) continue
        if (!buckets.has(key)) continue
        const b = buckets.get(key)!
        b.count += 1
        const valor = inferValorBem(it.inputs)
        if (typeof valor === "number" && Number.isFinite(valor) && valor > 0) {
          b.sumValorBem += valor
          b.countValorBem += 1
        }
      }

      const entries = Array.from(buckets.entries())
      const chartCount = entries.map(([k, b]) => ({ label: formatDayLabel(k), value: b.count }))
      const chartAvg = entries.map(([k, b]) => ({
        label: formatDayLabel(k),
        value: b.countValorBem > 0 ? b.sumValorBem / b.countValorBem : 0,
      }))
      const totalCount = entries.reduce((acc, [, b]) => acc + b.count, 0)
      const totalSumValorBem = entries.reduce((acc, [, b]) => acc + b.sumValorBem, 0)
      const totalCountValorBem = entries.reduce((acc, [, b]) => acc + b.countValorBem, 0)
      const avgValorBem = totalCountValorBem > 0 ? totalSumValorBem / totalCountValorBem : 0

      const maxCount = Math.max(1, ...chartCount.map((c) => c.value))
      const maxAvg = Math.max(1, ...chartAvg.map((c) => c.value))

      return { chartCount, chartAvg, totalCount, avgValorBem, maxCount, maxAvg }
    })()

    const totalValor = somaValores

    const porUsuario = items.reduce(
      (acc, it) => {
        const uid = it.user.id
        if (!acc[uid]) {
          acc[uid] = {
            userId: uid,
            name: it.user.name,
            email: it.user.email,
            role: it.user.role,
            totalSimulacoes: 0,
            somaValorBem: 0,
            countValorBem: 0,
          }
        }
        const bucket = acc[uid]
        bucket.totalSimulacoes += 1
        const valor = inferValorBem(it.inputs)
        if (typeof valor === "number" && Number.isFinite(valor) && valor > 0) {
          bucket.somaValorBem += valor
          bucket.countValorBem += 1
        }
        return acc
      },
      {} as Record<
        string,
        {
          userId: string
          name: string
          email: string
          role: string
          totalSimulacoes: number
          somaValorBem: number
          countValorBem: number
        }
      >,
    )

    const rankingUsuarios = Object.values(porUsuario)
      .map((u) => ({
        ...u,
        mediaValorBem: u.countValorBem > 0 ? u.somaValorBem / u.countValorBem : 0,
      }))
      .sort((a, b) => b.totalSimulacoes - a.totalSimulacoes)

    return {
      total,
      ultimos7Dias,
      byTipo,
      mediaValores,
      totalValor,
      prazoMedioMeses,
      series,
      rankingUsuarios,
      totalImoveis,
      totalAutomoveis,
    }
  }, [items])

  const filteredRanking = useMemo(
    () =>
      metrics.rankingUsuarios.filter((u) => {
        const term = consultantFilter.trim().toLowerCase()
        if (!term) return true
        const label = (u.name || u.email || "").toLowerCase()
        return label.includes(term)
      }),
    [metrics.rankingUsuarios, consultantFilter],
  )

  const selectedConsultant = useMemo(
    () => metrics.rankingUsuarios.find((u) => u.userId === selectedConsultantId) ?? null,
    [metrics.rankingUsuarios, selectedConsultantId],
  )

  const consultantMetrics = useMemo(() => {
    if (!selectedConsultantId) return null
    const scoped = items.filter((it) => it.user.id === selectedConsultantId)
    if (scoped.length === 0) return null

    const total = scoped.length

    const byTipo = scoped.reduce(
      (acc, it) => {
        const tipo = inferTipo(it.inputs)
        acc[tipo] = (acc[tipo] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const valores = scoped
      .map((it) => inferValorBem(it.inputs))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)

    const somaValores = valores.reduce((a, b) => a + b, 0)
    const mediaValores = valores.length > 0 ? somaValores / valores.length : 0

    const prazos = scoped
      .map((it) => inferPrazoMeses(it.inputs))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)

    const somaPrazos = prazos.reduce((a, b) => a + b, 0)
    const prazoMedioMeses = prazos.length > 0 ? somaPrazos / prazos.length : 0

    const ultimos7Dias = (() => {
      const now = Date.now()
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      return scoped.filter((it) => {
        const t = new Date(it.createdAt).getTime()
        if (!Number.isFinite(t)) return false
        return now - t <= sevenDays
      }).length
    })()

    const series = (() => {
      const now = Date.now()
      const days = 14
      const start = now - (days - 1) * 24 * 60 * 60 * 1000

      const buckets = new Map<string, { count: number; sumValorBem: number; countValorBem: number }>()
      for (let i = 0; i < days; i++) {
        const d = new Date(start + i * 24 * 60 * 60 * 1000)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        buckets.set(key, { count: 0, sumValorBem: 0, countValorBem: 0 })
      }

      for (const it of scoped) {
        const key = dayKey(it.createdAt)
        if (!key) continue
        if (!buckets.has(key)) continue
        const b = buckets.get(key)!
        b.count += 1
        const valor = inferValorBem(it.inputs)
        if (typeof valor === "number" && Number.isFinite(valor) && valor > 0) {
          b.sumValorBem += valor
          b.countValorBem += 1
        }
      }

      const entries = Array.from(buckets.entries())
      const chartCount = entries.map(([k, b]) => ({ label: formatDayLabel(k), value: b.count }))
      const chartAvg = entries.map(([k, b]) => ({
        label: formatDayLabel(k),
        value: b.countValorBem > 0 ? b.sumValorBem / b.countValorBem : 0,
      }))
      const totalCount = entries.reduce((acc, [, b]) => acc + b.count, 0)
      const totalSumValorBem = entries.reduce((acc, [, b]) => acc + b.sumValorBem, 0)
      const totalCountValorBem = entries.reduce((acc, [, b]) => acc + b.countValorBem, 0)
      const avgValorBem = totalCountValorBem > 0 ? totalSumValorBem / totalCountValorBem : 0

      const maxCount = Math.max(1, ...chartCount.map((c) => c.value))
      const maxAvg = Math.max(1, ...chartAvg.map((c) => c.value))

      return { chartCount, chartAvg, totalCount, avgValorBem, maxCount, maxAvg }
    })()

    const totalValor = somaValores

    return {
      total,
      ultimos7Dias,
      byTipo,
      mediaValores,
      totalValor,
      prazoMedioMeses,
      series,
    }
  }, [items, selectedConsultantId])

  const activeMetrics = selectedConsultant && consultantMetrics ? consultantMetrics : metrics

  if (!user) {
    return (
      <div className="rounded-xl bg-white/90 p-6 text-sm text-slate-600 shadow-sm">
        Faça login para ver insights.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl rounded-3xl bg-gradient-to-b from-slate-900/5 via-slate-900/0 to-slate-900/5 p-3 sm:p-4 md:p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Painel de Insights</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Visão esférica da performance das simulações: totais, ticket médio, evolução no tempo e destaque por consultor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Últimos 14 dias
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Dados em tempo (quase) real
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total de simulações</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">
                {loading ? "..." : activeMetrics.total}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Considerando o recorte de acesso do seu perfil.</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Ticket médio</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {loading ? "..." : formatCurrency(activeMetrics.mediaValores)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Média do valor do bem nas simulações.</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Valor total simulado</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {loading ? "..." : formatCurrency(activeMetrics.totalValor)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Soma dos valores dos bens em todas as simulações.</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Prazo médio</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {loading
                  ? "..."
                  : `${activeMetrics.prazoMedioMeses.toFixed(1).replace(".", ",")} meses`}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Média de prazo das simulações em meses.</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <RadialMetric
              label="Média do valor do bem"
              valueLabel={loading ? "..." : formatCurrency(metrics.series.avgValorBem)}
              value={metrics.series.avgValorBem}
              max={metrics.series.maxAvg}
              accentColor="#0ea5e9"
              subtleColor="#e0f2fe"
            />
            <RadialMetric
              label="Intensidade de simulações"
              valueLabel={loading ? "..." : `${metrics.series.totalCount} nos últimos 14 dias`}
              value={metrics.series.totalCount}
              max={metrics.series.maxCount}
              accentColor="#22c55e"
              subtleColor="#dcfce7"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Movimento diário de simulações
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Distribuição dos últimos 14 dias, unindo quantidade e valor médio.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Ticket médio por dia
              </div>
              <div className="text-[10px] font-semibold text-slate-500">
                {loading ? "..." : formatCompactValue(activeMetrics.series.avgValorBem)}
              </div>
            </div>
            <div className="flex items-end gap-1 overflow-hidden rounded-2xl bg-slate-50 p-3">
              {activeMetrics.series.chartAvg.map((d) => {
                const v = Number.isFinite(d.value) ? d.value : 0
                const h = activeMetrics.series.maxAvg > 0 ? (v / activeMetrics.series.maxAvg) * 64 : 0
                return (
                  <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-sky-500 to-sky-400"
                      style={{ height: `${Math.max(4, h)}px` }}
                    />
                    <span className="truncate text-[9px] text-slate-500">{d.label}</span>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
              {(() => {
                const total = metrics.totalImoveis + metrics.totalAutomoveis
                if (loading || total === 0) {
                  return (
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-50 text-[11px] text-slate-400">
                      {loading ? "Carregando..." : "Sem dados"}
                    </div>
                  )
                }

                const size = 148
                const strokeWidth = 20
                const radius = (size - strokeWidth) / 2
                const circumference = 2 * Math.PI * radius
                const imoveisFrac = metrics.totalImoveis / total
                const autosFrac = metrics.totalAutomoveis / total

                const imoveisDash = `${imoveisFrac * circumference} ${circumference}`
                const autosDash = `${autosFrac * circumference} ${circumference}`

                return (
                  <svg
                    viewBox={`0 0 ${size} ${size}`}
                    className="h-36 w-36 drop-shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
                  >
                    <defs>
                      <linearGradient id="chart-imovel" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.7" />
                      </linearGradient>
                      <linearGradient id="chart-auto" x1="0" x2="1" y1="1" y2="0">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
                      </linearGradient>
                    </defs>

                    <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#e2e8f0"
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                      />

                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="url(#chart-imovel)"
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={imoveisDash}
                        strokeLinecap="round"
                      />

                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="url(#chart-auto)"
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={autosDash}
                        strokeDashoffset={-imoveisFrac * circumference}
                        strokeLinecap="round"
                      />
                    </g>
                  </svg>
                )
              })()}

              <div className="space-y-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="font-medium">Imóveis</span>
                  <span className="ml-auto text-slate-500">
                    {loading ? "..." : `${metrics.totalImoveis} (${(
                      (metrics.totalImoveis /
                        Math.max(1, metrics.totalImoveis + metrics.totalAutomoveis)) *
                      100
                    ).toFixed(0)}%)`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  <span className="font-medium">Automóveis</span>
                  <span className="ml-auto text-slate-500">
                    {loading ? "..." : `${metrics.totalAutomoveis} (${(
                      (metrics.totalAutomoveis /
                        Math.max(1, metrics.totalImoveis + metrics.totalAutomoveis)) *
                      100
                    ).toFixed(0)}%)`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(user.profile.role === "Supervisor" || user.profile.role === "Gerente" || user.profile.role === "Admin") && (
        <div className="mt-6 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Desempenho por consultor
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Média de ticket e volume de simulações por membro da equipe visível para o seu perfil.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Filtro de consultores
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                type="text"
                value={consultantFilter}
                onChange={(e) => {
                  setConsultantFilter(e.target.value)
                  setSelectedConsultantId(null)
                }}
                placeholder="Filtrar por nome ou e-mail"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 shadow-inner outline-none focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-300 sm:w-64"
              />
              <button
                type="button"
                onClick={() => {
                  setConsultantFilter("")
                  setSelectedConsultantId(null)
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
              >
                Ver todos
              </button>
            </div>
          </div>

          {filteredRanking.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Ainda não há simulações suficientes para compor o ranking dos consultores.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {filteredRanking.slice(0, 12).map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => setSelectedConsultantId(u.userId)}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:border-sky-200 hover:bg-sky-50/80 hover:shadow-md"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-slate-900">{u.name || u.email}</div>
                    <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {u.role}
                    </span>
                  </div>
                  <div className="flex w-full items-end justify-between gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">Média de ticket</div>
                      <div className="text-sm font-semibold text-slate-900">{formatCurrency(u.mediaValorBem)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Simulações</div>
                      <div className="text-sm font-semibold text-slate-900">{u.totalSimulacoes}</div>
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Clique para ver o resumo deste consultor abaixo e, se desejar, use o histórico para aprofundar.
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quando um consultor é selecionado, o painel principal acima já passa a usar os dados dele via activeMetrics. */}
        </div>
      )}
    </div>
  )
}
