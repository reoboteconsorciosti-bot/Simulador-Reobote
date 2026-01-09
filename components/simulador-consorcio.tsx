"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calculator, TrendingUp, CreditCard, Wallet, BarChart3, Target } from "lucide-react"
import { ComparisonResults } from "@/components/comparison-results"
import { useAuth } from "@/components/auth-context"
import { formatCurrency } from "@/lib/formatters"
import { calculateSimulation, type SimulationInputs, type SimulationOutputs } from "@/lib/calculate-simulation"

// Helpers para lidar com campos monetários em formato brasileiro ("120.000,00")
const parseCurrencyInput = (value: string): number => {
  if (!value) return 0
  // Remove espaços e símbolo de moeda
  const cleaned = value.replace(/[^0-9.,]/g, "").trim()
  if (!cleaned) return 0
  // Remove separadores de milhar e troca vírgula decimal por ponto
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".")
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

const formatCurrencyInputValue = (value: string): string => {
  const numeric = parseCurrencyInput(value)
  if (!numeric) return ""
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Calcula em quantos meses, guardando o valor da parcela do consórcio,
// a pessoa atinge o valor alvo (carta ou crédito disponível), sem juros nem rendimento.
const calcularMesesAcumulacaoConsorcio = (
  valorParcelaConsorcio: number,
  valorCartaCredito: number,
  valorLanceEmbutido?: number,
): number => {
  if (valorParcelaConsorcio <= 0 || valorCartaCredito <= 0) return 0

  const lance = valorLanceEmbutido && valorLanceEmbutido > 0 ? valorLanceEmbutido : 0
  const valorAlvo = Math.max(0, valorCartaCredito - lance)
  if (valorAlvo === 0) return 0

  // Soma simples, arredondando sempre para cima
  return Math.ceil(valorAlvo / valorParcelaConsorcio)
}

// Parser genérico para campos de porcentagem ("2,5" ou "2.5" -> 2.5)
const parsePercentInput = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue
  const cleaned = value.replace(/,/g, ".").trim()
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n)) return defaultValue
  return n
}

const RENDIMENTO_POUPANCA_PADRAO = 0.6
const TAXA_CDB_PADRAO = 1.0
const TAXA_CARTA_CREDITO_PADRAO = 0.7

const SIMULATOR_STORAGE_KEY = "sim-pro-simulator-state"

export function SimuladorConsorcio() {
  const { user } = useAuth()
  const [tipoSimulacao, setTipoSimulacao] = useState<"consorcio" | "financiamento">("consorcio")

  const [loadedOutputs, setLoadedOutputs] = useState<{
    tipoSimulacao: "consorcio" | "financiamento"
    consorcio: any
    financiamento: any
    aVista: any
    outros: any
    simulacaoOficial?: any
    percentualParcelaBase?: number | null
    percentualParcelaOficial?: number | null
  } | null>(null)

  const [valorBem, setValorBem] = useState<string>("")
  const [prazoMeses, setPrazoMeses] = useState<string>("")
  const [valorBemFin, setValorBemFin] = useState<string>("")
  const [prazoMesesFin, setPrazoMesesFin] = useState<string>("")
  const [taxaAdministracao, setTaxaAdministracao] = useState<string>("")
  const [fundoReserva, setFundoReserva] = useState<string>("")
  const [lanceConsorcio, setLanceConsorcio] = useState<string>("")
  const [tipoLance, setTipoLance] = useState<"livre" | "embutido" | "ambos">("livre")
  const [lanceEmbutidoPercent, setLanceEmbutidoPercent] = useState<string>("")
  const [taxaFinanciamento, setTaxaFinanciamento] = useState<string>("")
  const [entrada, setEntrada] = useState<string>("")
  const [showResults, setShowResults] = useState(false)
  const [planoLight, setPlanoLight] = useState<string>("1")
  const [seguroPrestamista, setSeguroPrestamista] = useState<string>("3")
  const [percentualOfertado, setPercentualOfertado] = useState<string>("")
  const [percentualEmbutido, setPercentualEmbutido] = useState<string>("")
  const [diluirLance, setDiluirLance] = useState<string>("1")
  // 0 ou vazio = não considerar mês de lance (igual planilha)
  const [lanceNaAssembleia, setLanceNaAssembleia] = useState<string>("")
  const [percentualParcelaBase, setPercentualParcelaBase] = useState<number | null>(null)
  const [percentualParcelaOficial, setPercentualParcelaOficial] = useState<number | null>(null)
  const [simulacaoOficial, setSimulacaoOficial] = useState<SimulationOutputs | null>(null)
  const [nomeCliente, setNomeCliente] = useState<string>("")
  const [nomeConsultor, setNomeConsultor] = useState<string>("")
  const [tipoBem, setTipoBem] = useState<"imovel" | "automovel">("imovel")
  const [errosObrigatorios, setErrosObrigatorios] = useState({
    valorBem: false,
    prazoMeses: false,
    taxaAdministracao: false,
  })
  const [lanceError, setLanceError] = useState<string | null>(null)

  const baseValorBem = tipoSimulacao === "financiamento" ? valorBemFin : valorBem
  const basePrazoMeses = tipoSimulacao === "financiamento" ? prazoMesesFin : prazoMeses

  const resultadosRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!user?.profile?.name) return
    setNomeConsultor((current) => (current && current.trim().length > 0 ? current : user.profile.name))
  }, [user?.profile?.name])

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ inputs?: any; outputs?: any }>
      const { inputs, outputs } = custom.detail || {}
      if (!inputs || !outputs) return

      const inferredTipoFromOutputs = outputs?.simulacaoOficial ? "consorcio" : null
      if (inputs.tipoSimulacao === "consorcio" || inputs.tipoSimulacao === "financiamento") {
        setTipoSimulacao(inputs.tipoSimulacao)
      } else if (inferredTipoFromOutputs) {
        setTipoSimulacao(inferredTipoFromOutputs)
      }
      if (typeof inputs.valorBem === "string" && inputs.valorBem.trim() !== "") setValorBem(inputs.valorBem)
      else if (typeof inputs.valorBemNumero === "number" && Number.isFinite(inputs.valorBemNumero) && inputs.valorBemNumero > 0) {
        setValorBem(
          inputs.valorBemNumero.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )
      }

      if (typeof inputs.valorBemFin === "string" && inputs.valorBemFin.trim() !== "") setValorBemFin(inputs.valorBemFin)
      else if (
        typeof inputs.valorBemFinNumero === "number" &&
        Number.isFinite(inputs.valorBemFinNumero) &&
        inputs.valorBemFinNumero > 0
      ) {
        setValorBemFin(
          inputs.valorBemFinNumero.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )
      }

      if (typeof inputs.prazoMeses === "string" && inputs.prazoMeses.trim() !== "") setPrazoMeses(inputs.prazoMeses)
      else if (typeof inputs.prazoMesesNumero === "number" && Number.isFinite(inputs.prazoMesesNumero) && inputs.prazoMesesNumero > 0) {
        setPrazoMeses(String(inputs.prazoMesesNumero))
      }

      if (typeof inputs.prazoMesesFin === "string" && inputs.prazoMesesFin.trim() !== "") setPrazoMesesFin(inputs.prazoMesesFin)
      else if (
        typeof inputs.prazoMesesFinNumero === "number" &&
        Number.isFinite(inputs.prazoMesesFinNumero) &&
        inputs.prazoMesesFinNumero > 0
      ) {
        setPrazoMesesFin(String(inputs.prazoMesesFinNumero))
      }

      if (typeof inputs.taxaAdministracao === "string" && inputs.taxaAdministracao.trim() !== "")
        setTaxaAdministracao(inputs.taxaAdministracao)
      else if (
        typeof inputs.taxaAdministracaoNumero === "number" &&
        Number.isFinite(inputs.taxaAdministracaoNumero) &&
        inputs.taxaAdministracaoNumero > 0
      ) {
        setTaxaAdministracao(String(inputs.taxaAdministracaoNumero))
      }
      if (typeof inputs.fundoReserva === "string") setFundoReserva(inputs.fundoReserva)
      if (typeof inputs.lanceConsorcio === "string") setLanceConsorcio(inputs.lanceConsorcio)
      if (inputs.tipoLance === "livre" || inputs.tipoLance === "embutido" || inputs.tipoLance === "ambos") {
        setTipoLance(inputs.tipoLance)
      }
      if (typeof inputs.lanceEmbutidoPercent === "string") setLanceEmbutidoPercent(inputs.lanceEmbutidoPercent)
      if (typeof inputs.taxaFinanciamento === "string") setTaxaFinanciamento(inputs.taxaFinanciamento)
      if (typeof inputs.entrada === "string") setEntrada(inputs.entrada)

      if (typeof inputs.planoLight === "string") setPlanoLight(inputs.planoLight)
      if (typeof inputs.seguroPrestamista === "string") setSeguroPrestamista(inputs.seguroPrestamista)
      if (typeof inputs.percentualOfertado === "string") setPercentualOfertado(inputs.percentualOfertado)
      if (typeof inputs.percentualEmbutido === "string") setPercentualEmbutido(inputs.percentualEmbutido)
      if (typeof inputs.diluirLance === "string") setDiluirLance(inputs.diluirLance)
      if (typeof inputs.lanceNaAssembleia === "string") setLanceNaAssembleia(inputs.lanceNaAssembleia)

      if (typeof inputs.nomeCliente === "string") setNomeCliente(inputs.nomeCliente)
      if (inputs.tipoBem === "imovel" || inputs.tipoBem === "automovel") setTipoBem(inputs.tipoBem)

      const tipoFromOutputs =
        outputs?.tipoSimulacao === "financiamento"
          ? "financiamento"
          : outputs?.simulacaoOficial
            ? "consorcio"
            : "consorcio"

      setLoadedOutputs({
        tipoSimulacao: tipoFromOutputs,
        consorcio: outputs?.consorcio,
        financiamento: outputs?.financiamento,
        aVista: outputs?.aVista,
        outros: outputs?.outros,
        simulacaoOficial: outputs?.simulacaoOficial,
        percentualParcelaBase: typeof outputs?.percentualParcelaBase === "number" ? outputs.percentualParcelaBase : null,
        percentualParcelaOficial:
          typeof outputs?.percentualParcelaOficial === "number"
            ? outputs.percentualParcelaOficial
            : typeof outputs?.simulacaoOficial?.percentualParcela === "number"
              ? outputs.simulacaoOficial.percentualParcela
              : null,
      })

      setSimulacaoOficial(outputs.simulacaoOficial ?? null)
      setPercentualParcelaBase(typeof outputs.percentualParcelaBase === "number" ? outputs.percentualParcelaBase : null)
      setPercentualParcelaOficial(
        typeof outputs.percentualParcelaOficial === "number"
          ? outputs.percentualParcelaOficial
          : typeof outputs?.simulacaoOficial?.percentualParcela === "number"
            ? outputs.simulacaoOficial.percentualParcela
            : null,
      )
      setErrosObrigatorios({ valorBem: false, prazoMeses: false, taxaAdministracao: false })
      setShowResults(true)
    }

    window.addEventListener("sim-pro-load-simulation", handler)
    return () => window.removeEventListener("sim-pro-load-simulation", handler)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("sim-pro-reload-simulation")
      if (!raw) return
      const parsed = JSON.parse(raw) as { inputs?: any; outputs?: any }
      if (!parsed?.inputs || !parsed?.outputs) return

      // Mantém a flag de reload até o próximo tick para impedir que o restore do SIMULATOR_STORAGE_KEY
      // sobrescreva os campos recém-carregados.
      window.dispatchEvent(
        new CustomEvent("sim-pro-load-simulation", {
          detail: { inputs: parsed.inputs, outputs: parsed.outputs },
        }),
      )

      window.setTimeout(() => {
        try {
          window.localStorage.removeItem("sim-pro-reload-simulation")
          window.localStorage.removeItem("sim-pro-reload-in-progress")
        } catch {
          // ignora
        }
      }, 0)
    } catch {
      // ignora
    }
  }, [])

  const simulatorSnapshot = useMemo(
    () => ({
      tipoSimulacao,
      valorBem,
      prazoMeses,
      valorBemFin,
      prazoMesesFin,
      taxaAdministracao,
      fundoReserva,
      lanceConsorcio,
      tipoLance,
      lanceEmbutidoPercent,
      taxaFinanciamento,
      entrada,
      planoLight,
      seguroPrestamista,
      percentualOfertado,
      percentualEmbutido,
      diluirLance,
      lanceNaAssembleia,
      nomeCliente,
      nomeConsultor,
      tipoBem,
    }),
    [
      tipoSimulacao,
      valorBem,
      prazoMeses,
      valorBemFin,
      prazoMesesFin,
      taxaAdministracao,
      fundoReserva,
      lanceConsorcio,
      tipoLance,
      lanceEmbutidoPercent,
      taxaFinanciamento,
      entrada,
      planoLight,
      seguroPrestamista,
      percentualOfertado,
      percentualEmbutido,
      diluirLance,
      lanceNaAssembleia,
      nomeCliente,
      nomeConsultor,
      tipoBem,
    ],
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const reloadInProgress = window.localStorage.getItem("sim-pro-reload-in-progress")
      if (reloadInProgress) return
      const raw = window.localStorage.getItem(SIMULATOR_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<typeof simulatorSnapshot>

      if (parsed.tipoSimulacao === "consorcio" || parsed.tipoSimulacao === "financiamento") {
        setTipoSimulacao(parsed.tipoSimulacao)
      }
      if (typeof parsed.valorBem === "string") setValorBem(parsed.valorBem)
      if (typeof parsed.prazoMeses === "string") setPrazoMeses(parsed.prazoMeses)
      if (typeof (parsed as any).valorBemFin === "string") setValorBemFin((parsed as any).valorBemFin)
      if (typeof (parsed as any).prazoMesesFin === "string") setPrazoMesesFin((parsed as any).prazoMesesFin)
      if (typeof parsed.taxaAdministracao === "string") setTaxaAdministracao(parsed.taxaAdministracao)
      if (typeof parsed.fundoReserva === "string") setFundoReserva(parsed.fundoReserva)
      if (typeof parsed.lanceConsorcio === "string") setLanceConsorcio(parsed.lanceConsorcio)
      if (parsed.tipoLance === "livre" || parsed.tipoLance === "embutido" || parsed.tipoLance === "ambos") {
        setTipoLance(parsed.tipoLance)
      }
      if (typeof parsed.lanceEmbutidoPercent === "string") setLanceEmbutidoPercent(parsed.lanceEmbutidoPercent)
      if (typeof parsed.taxaFinanciamento === "string") setTaxaFinanciamento(parsed.taxaFinanciamento)
      if (typeof parsed.entrada === "string") setEntrada(parsed.entrada)
      if (typeof parsed.planoLight === "string") setPlanoLight(parsed.planoLight)
      if (typeof parsed.seguroPrestamista === "string") setSeguroPrestamista(parsed.seguroPrestamista)
      if (typeof parsed.percentualOfertado === "string") setPercentualOfertado(parsed.percentualOfertado)
      if (typeof parsed.percentualEmbutido === "string") setPercentualEmbutido(parsed.percentualEmbutido)
      if (typeof parsed.diluirLance === "string") setDiluirLance(parsed.diluirLance)
      if (typeof parsed.lanceNaAssembleia === "string") setLanceNaAssembleia(parsed.lanceNaAssembleia)
      if (typeof parsed.nomeCliente === "string") setNomeCliente(parsed.nomeCliente)
      if (parsed.tipoBem === "imovel" || parsed.tipoBem === "automovel") setTipoBem(parsed.tipoBem)
    } catch {
      // ignora
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(SIMULATOR_STORAGE_KEY, JSON.stringify(simulatorSnapshot))
    } catch {
      // ignora
    }
  }, [simulatorSnapshot])

  const salvarSimulacao = async (payload: { inputs: unknown; outputs: unknown }) => {
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        console.error("Falha ao salvar simulação", res.status, data)
        return
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sim-pro-simulation-saved"))
      }
    } catch {
      console.error("Falha ao salvar simulação")
    }
  }

  const handleCalcularSimulacaoOficial = (): SimulationOutputs | null => {
    const prazoNumero = Number(basePrazoMeses) || 0
    const taxaNumero = Number(taxaAdministracao) || 0

    const inputs: SimulationInputs = {
      clienteNome: "",
      consultorNome: "",
      tipoBem: "Imóvel",
      credito: parseCurrencyInput(baseValorBem) || 0,
      qtdMeses: prazoNumero,
      taxa: taxaNumero,
      planoLight: Number(planoLight) || 1,
      seguroPrestamista: Number(seguroPrestamista) || 3,
      percentualOfertado: Number(percentualOfertado) || 0,
      percentualEmbutido: Number(percentualEmbutido) || 0,
      qtdParcelasOfertado: 0,
      diluirLance: Number(diluirLance) || 1,
      lanceNaAssembleia: Number(lanceNaAssembleia) || 0,
    }

    const resultado = calculateSimulation(inputs)
    if (!resultado) {
      setPercentualParcelaBase(null)
      setPercentualParcelaOficial(null)
      setSimulacaoOficial(null)
      return null
    }

    setPercentualParcelaBase(null)
    setPercentualParcelaOficial(resultado.percentualParcela)
    setSimulacaoOficial(resultado)
    return resultado
  }

  const calcularConsorcio = () => {
    const valor = parseCurrencyInput(baseValorBem)
    const prazo = Number.parseInt(basePrazoMeses)
    const taxaAdminRaw = Number.parseFloat(taxaAdministracao)
    const fundoResRaw = Number.parseFloat(fundoReserva)
    const percLanceRaw = Number.parseFloat(lanceConsorcio)

    if (!valor || !prazo) {
      return {
        parcelaMensal: 0,
        custoTotal: 0,
        taxaAdminTotal: 0,
        fundoReservaTotal: 0,
        valorBem: valor || 0,
        valorLance: 0,
        valorLanceLivre: 0,
        valorLanceEmbutido: 0,
        tipoLance,
      }
    }

    const taxaAdmin = (Number.isNaN(taxaAdminRaw) ? 0 : taxaAdminRaw) / 100
    const fundoRes = (Number.isNaN(fundoResRaw) ? 0 : fundoResRaw) / 100
    const percLance = (Number.isNaN(percLanceRaw) ? 0 : percLanceRaw) / 100
    const valorLanceTotal = valor * percLance

    let valorLance = valorLanceTotal
    let valorLanceLivre = 0
    let valorLanceEmbutido = 0

    let baseCarta = valor

    if (valorLanceTotal > 0) {
      if (tipoLance === "livre") {
        valorLanceLivre = valorLanceTotal
        baseCarta = valor
      } else if (tipoLance === "embutido") {
        valorLanceEmbutido = valorLanceTotal
        baseCarta = Math.max(valor - valorLanceEmbutido, 0)
      } else if (tipoLance === "ambos") {
        const percEmbutido = Number.parseFloat(lanceEmbutidoPercent) / 100
        valorLanceEmbutido = valorLanceTotal * percEmbutido
        valorLanceLivre = valorLanceTotal * (1 - percEmbutido)
        baseCarta = Math.max(valor - valorLanceEmbutido, 0)
      }
    }

    const taxaAdminTotal = baseCarta * taxaAdmin
    const fundoReservaTotal = baseCarta * fundoRes

    const custoTotalParcelado = baseCarta + taxaAdminTotal + fundoReservaTotal
    const parcelaMensal = custoTotalParcelado / prazo

    const custoTotal = custoTotalParcelado + valorLanceLivre

    return {
      parcelaMensal,
      custoTotal,
      taxaAdminTotal,
      fundoReservaTotal,
      valorBem: valor,
      valorLance,
      valorLanceLivre,
      valorLanceEmbutido,
      tipoLance,
    }
  }

  const calcularFinanciamento = () => {
    const valor = parseCurrencyInput(baseValorBem)
    const prazo = Number.parseInt(basePrazoMeses)
    const taxaMensalRaw = Number.parseFloat(taxaFinanciamento)
    const percEntradaRaw = Number.parseFloat(entrada)

    if (!valor || !prazo) {
      return {
        parcelaMensal: 0,
        custoTotal: 0,
        valorEntrada: 0,
        jurosTotal: 0,
        valorBem: valor || 0,
      }
    }

    const taxaMensal = (Number.isNaN(taxaMensalRaw) ? 0 : taxaMensalRaw) / 100
    const percEntrada = (Number.isNaN(percEntradaRaw) ? 0 : percEntradaRaw) / 100

    const valorEntrada = valor * percEntrada
    const valorFinanciado = valor - valorEntrada

    let parcelaMensal: number
    if (taxaMensal === 0) {
      parcelaMensal = prazo > 0 ? valorFinanciado / prazo : 0
    } else {
      const fator = Math.pow(1 + taxaMensal, prazo)
      parcelaMensal = (valorFinanciado * (taxaMensal * fator)) / (fator - 1)
    }

    const totalPago = parcelaMensal * prazo + valorEntrada
    const jurosTotal = totalPago - valor

    return {
      parcelaMensal,
      custoTotal: totalPago,
      valorEntrada,
      jurosTotal,
      valorBem: valor,
    }
  }

  const calcularAVista = () => {
    const valor = parseCurrencyInput(baseValorBem)
    const prazo = Number.parseInt(basePrazoMeses)
    const rendMensal = RENDIMENTO_POUPANCA_PADRAO / 100

    if (!valor || !prazo) {
      return {
        parcelaMensal: 0,
        custoTotal: 0,
        economizado: 0,
        valorBem: valor || 0,
        disciplinaRequerida: true,
      }
    }

    const fatorCustoOportunidade = 1.15
    const parcelaMensal = (valor * fatorCustoOportunidade) / prazo
    const valorFinalNecessario = valor * fatorCustoOportunidade

    return {
      parcelaMensal,
      custoTotal: valorFinalNecessario,
      economizado: 0,
      valorBem: valor,
      disciplinaRequerida: true,
    }
  }

  const calcularOutros = () => {
    const valor = parseCurrencyInput(baseValorBem)
    const prazo = Number.parseInt(basePrazoMeses)

    const taxaAluguel = 0.01
    const parcelaMensal = valor * taxaAluguel
    const custoTotal = parcelaMensal * prazo

    return {
      parcelaMensal,
      custoTotal,
      valorBem: valor,
      tipo: "Aluguel com opção de compra",
    }
  }

  const handleSimular = () => {
    const faltandoValorBem = !baseValorBem || baseValorBem.trim() === ""
    const faltandoPrazo = !basePrazoMeses || basePrazoMeses.trim() === ""
    const faltandoTaxa = tipoSimulacao === "consorcio" ? !taxaAdministracao || taxaAdministracao.trim() === "" : false

    const temErro = faltandoValorBem || faltandoPrazo || faltandoTaxa
    setErrosObrigatorios({
      valorBem: faltandoValorBem,
      prazoMeses: faltandoPrazo,
      taxaAdministracao: faltandoTaxa,
    })

    if (temErro) {
      return
    }

    const ofertadoNumero = Number(percentualOfertado) || 0
    const embutidoNumero = Number(percentualEmbutido) || 0

    if (embutidoNumero > 0 && embutidoNumero > ofertadoNumero) {
      setLanceError("O lance embutido (%) deve ser menor que o lance ofertado (%).")
      return
    }

    setLanceError(null)

    // Dispara também a simulação oficial da planilha
    const oficial = handleCalcularSimulacaoOficial()
    setShowResults(true)

    // Ao simular novamente, o resultado passa a ser o calculado no momento.
    setLoadedOutputs(null)

    // Persiste a simulação (backend aplica recorte por perfil no histórico)
    void salvarSimulacao({
      inputs: {
        ...simulatorSnapshot,
        tipoSimulacao,
        valorBemNumero: parseCurrencyInput(baseValorBem),
        prazoMesesNumero: Number(basePrazoMeses) || 0,
        taxaAdministracaoNumero: Number(taxaAdministracao) || 0,
        valorBemFinNumero: parseCurrencyInput(valorBemFin),
        prazoMesesFinNumero: Number(prazoMesesFin) || 0,
      },
      outputs: {
        tipoSimulacao,
        consorcio,
        financiamento,
        aVista,
        outros,
        simulacaoOficial: oficial,
        percentualParcelaBase,
        percentualParcelaOficial,
      },
    })

    // Após mostrar os resultados, rola suavemente para o container principal de resultados
    // setTimeout(() => {
    //   resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    // }, 50)
  }

  const consorcio = calcularConsorcio()
  const financiamento = calcularFinanciamento()
  const aVista = calcularAVista()
  const outros = calcularOutros()

  const effectiveTipoSimulacao = loadedOutputs?.tipoSimulacao ?? tipoSimulacao
  const effectiveConsorcio = (loadedOutputs?.consorcio as any) ?? consorcio
  const effectiveFinanciamento = (loadedOutputs?.financiamento as any) ?? financiamento
  const effectiveAVista = (loadedOutputs?.aVista as any) ?? aVista
  const effectiveOutros = (loadedOutputs?.outros as any) ?? outros

  const prazoNumber = Number.parseInt(basePrazoMeses) || 1

  const calcularRentabilidadeMensal = (custoTotal: number, valor: number, prazo: number) => {
    if (!valor || !prazo || custoTotal <= 0) return 0
    const fatorTotal = custoTotal / valor
    if (fatorTotal <= 0) return 0
    return Math.pow(fatorTotal, 1 / prazo) - 1
  }

  const rentabilidadeConsorcio = calcularRentabilidadeMensal(
    effectiveConsorcio.custoTotal,
    effectiveConsorcio.valorBem,
    prazoNumber,
  )
  const rentabilidadeFinanciamento = calcularRentabilidadeMensal(
    effectiveFinanciamento.custoTotal,
    effectiveFinanciamento.valorBem,
    prazoNumber,
  )

  const calcularInvestimentoComTaxa = (valorInicial: number, prazo: number, taxaMensalPercent: number) => {
    const taxa = taxaMensalPercent / 100
    if (!valorInicial || !prazo || taxa < -1) {
      return {
        valorFinal: 0,
        ganho: 0,
        taxaMensal: taxa,
      }
    }

    const valorFinal = valorInicial * Math.pow(1 + taxa, prazo)
    return {
      valorFinal,
      ganho: valorFinal - valorInicial,
      taxaMensal: taxa,
    }
  }

  const valorCarta = parseCurrencyInput(baseValorBem) || 0
  const cartaParada = calcularInvestimentoComTaxa(valorCarta, prazoNumber, TAXA_CARTA_CREDITO_PADRAO)
  const investimentoCdb = calcularInvestimentoComTaxa(valorCarta, prazoNumber, TAXA_CDB_PADRAO)
  const investimentoPoupanca = calcularInvestimentoComTaxa(valorCarta, prazoNumber, RENDIMENTO_POUPANCA_PADRAO)

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="text-center mb-12">
        <div className="flex flex-col items-center gap-4 text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Calculator className="w-6 h-6 text-primary-foreground" />
          </div>

          {/* Logo Reobote Consórcios como título visual */}
          <h1 className="sr-only">Simulador de Consórcios Reobote Conórcios</h1>
          <div className="flex flex-col items-center justify-center">
            <img
              src="https://reoboteconsorcios.com.br/wp-content/uploads/2024/01/reobote-1a-300x171.png"
              alt="Reobote Consórcios"
              className="h-20 w-auto object-contain drop-shadow-sm"
            />
            
          </div>
        </div>
        <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
          Compare diferentes modalidades de aquisição e escolha a melhor opção para realizar seu sonho
        </p>
      </div>

      <motion.div
        transition={{ duration: 0.45, ease: "easeInOut", type: "tween" }}
        className={
          showResults
            ? "grid lg:grid-cols-3 gap-6"
            : "flex min-h-[60vh] items-center justify-center"
        }
      >
        <motion.div
          layout="position"
          layoutId="config-panel"
          transition={{ duration: 0.45, ease: "easeInOut", type: "tween" }}
          className={
            showResults
              ? "lg:col-span-1 lg:sticky lg:top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto space-y-4"
              : "w-full max-w-xl space-y-4"
          }
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Dados da Proposta
              </CardTitle>
              <CardDescription>Informe os dados básicos do cliente e do consultor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nomeCliente">Nome do cliente</Label>
                <Input
                  id="nomeCliente"
                  type="text"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Digite o nome do cliente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nomeConsultor">Nome do consultor</Label>
                <Input
                  id="nomeConsultor"
                  type="text"
                  value={nomeConsultor}
                  onChange={(e) => setNomeConsultor(e.target.value)}
                  placeholder="Digite o nome do consultor"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de bem</Label>
                <RadioGroup
                  value={tipoBem}
                  onValueChange={(v) => setTipoBem(v as "imovel" | "automovel")}
                  className="flex flex-col gap-2 sm:flex-row sm:gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="tipo-imovel" value="imovel" />
                    <Label htmlFor="tipo-imovel" className="text-sm">
                      Imóvel
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="tipo-automovel" value="automovel" />
                    <Label htmlFor="tipo-automovel" className="text-sm">
                      Automóvel
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Card className={showResults ? "" : "aspect-square"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Configurações
              </CardTitle>
              <CardDescription>Personalize os parâmetros da simulação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            <Tabs
              value={tipoSimulacao}
              onValueChange={(v) => setTipoSimulacao(v as "consorcio" | "financiamento")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="consorcio">Consórcio</TabsTrigger>
                <TabsTrigger value="financiamento">Financiamento</TabsTrigger>
              </TabsList>

              <TabsContent value="consorcio" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="valorBem">Valor do Bem (R$)</Label>
                  <Input
                    id="valorBem"
                    type="text"
                    value={valorBem}
                    onChange={(e) => {
                      // Máscara de moeda em tempo real (formato BR): mantém só dígitos e formata como R$ xx.xxx,yy
                      const digitsOnly = e.target.value.replace(/\D/g, "")

                      if (!digitsOnly) {
                        setValorBem("")
                        return
                      }

                      const numeric = Number.parseInt(digitsOnly, 10)
                      const valueAsNumber = numeric / 100
                      const formatted = valueAsNumber.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                      setValorBem(formatted)
                    }}
                    placeholder="120.000,00"
                    className={errosObrigatorios.valorBem ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errosObrigatorios.valorBem && (
                    <p className="text-xs text-red-600">Este campo é obrigatório.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prazoMeses">Prazo (meses)</Label>
                  <Input
                    id="prazoMeses"
                    type="number"
                    value={prazoMeses}
                    onChange={(e) => setPrazoMeses(e.target.value)}
                    placeholder="60"
                    className={errosObrigatorios.prazoMeses ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errosObrigatorios.prazoMeses && (
                    <p className="text-xs text-red-600">Informe o prazo em meses.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxaAdmin">Taxa de Administração (%)</Label>
                  <Input
                    id="taxaAdmin"
                    type="number"
                    step="0.1"
                    value={taxaAdministracao}
                    onChange={(e) => setTaxaAdministracao(e.target.value)}
                    placeholder="15"
                    className={errosObrigatorios.taxaAdministracao ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {errosObrigatorios.taxaAdministracao && (
                    <p className="text-xs text-red-600">Informe a taxa de administração.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="percentualParcelaOficial">% da Parcela após plano</Label>
                  <Input
                    id="percentualParcelaOficial"
                    type="text"
                    value={
                      percentualParcelaOficial !== null
                        ? `${percentualParcelaOficial.toFixed(4).replace(".", ",")}%`
                        : ""
                    }
                    readOnly
                    placeholder="Gerado pela Simulação Oficial"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="planoLight">Plano Redução</Label>
                    <select
                      id="planoLight"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={planoLight}
                      onChange={(e) => setPlanoLight(e.target.value)}
                    >
                      <option value="1">Integral (Sem redução)</option>
                      <option value="2">Plano Flex 10%</option>
                      <option value="3">Plano Flex 20%</option>
                      <option value="4">Plano Flex 30%</option>
                      <option value="5">Plano Flex 40%</option>
                      <option value="6">Plano Flex 50%</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seguroPrestamista">Seguro Prestamista</Label>
                    <select
                      id="seguroPrestamista"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={seguroPrestamista}
                      onChange={(e) => setSeguroPrestamista(e.target.value)}
                    >
                      <option value="1">Automóvel</option>
                      <option value="2">Imóvel</option>
                      <option value="3">Sem seguro</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Configuração Oficial do Lance</Label>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="percentualOfertado">Lance Ofertado (%)</Label>
                      <Input
                        id="percentualOfertado"
                        type="number"
                        step="0.1"
                        value={percentualOfertado}
                        onChange={(e) => setPercentualOfertado(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="percentualEmbutido">Lance Embutido (%)</Label>
                      <Input
                        id="percentualEmbutido"
                        type="number"
                        step="0.1"
                        value={percentualEmbutido}
                        onChange={(e) => setPercentualEmbutido(e.target.value)}
                        placeholder="0"
                        className={lanceError ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lanceNaAssembleia">Mês do Lance (Assembleia)</Label>
                      <Input
                        id="lanceNaAssembleia"
                        type="number"
                        step="1"
                        value={lanceNaAssembleia}
                        onChange={(e) => setLanceNaAssembleia(e.target.value)}
                        placeholder="0 (sem mês definido)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diluirLance">Forma de Abatimento do Lance</Label>
                      <select
                        id="diluirLance"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={diluirLance}
                        onChange={(e) => setDiluirLance(e.target.value)}
                      >
                        <option value="1">Sim (Abater Prazo)</option>
                        <option value="2">LUDC</option>
                        <option value="3">Não (Abater Parcelas)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 items-end pt-2 border-t border-muted">
                    <div className="space-y-1 text-sm">
                      {lanceError && <p className="text-xs text-red-600">{lanceError}</p>}
                      <p className="font-medium">Lance Pago</p>
                      <p className="text-muted-foreground">
                        {Math.max(
                          0,
                          (Number(percentualOfertado) || 0) - (Number(percentualEmbutido) || 0),
                        ).toFixed(2)}
                        %
                      </p>
                      <p className="text-muted-foreground">
                        {simulacaoOficial
                          ? formatCurrency(
                              Math.max(
                                0,
                                simulacaoOficial.lanceOfertadoValor - simulacaoOficial.lanceEmbutidoValor,
                              ),
                            )
                          : "R$ 0,00"}
                      </p>
                      <p className="text-muted-foreground">
                        {simulacaoOficial
                          ? `Lance embutido: ${formatCurrency(simulacaoOficial.lanceEmbutidoValor)}`
                          : "Lance embutido: R$ 0,00"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Rentabilidade das Opções (% a.m. equivalente)</Label>
                  <div className="rounded-md border bg-muted px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Consórcio</span>
                      <span className="font-semibold">
                        {(rentabilidadeConsorcio * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Financiamento</span>
                      <span className="font-semibold text-red-600">
                        {(rentabilidadeFinanciamento * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financiamento" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="valorBemFin">Valor do Bem (R$)</Label>
                  <Input
                    id="valorBemFin"
                    type="text"
                    value={valorBemFin}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "")

                      if (!digitsOnly) {
                        setValorBemFin("")
                        return
                      }

                      const numeric = Number.parseInt(digitsOnly, 10)
                      const valueAsNumber = numeric / 100
                      const formatted = valueAsNumber.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                      setValorBemFin(formatted)
                    }}
                    placeholder="120.000,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prazoMesesFin">Prazo (meses)</Label>
                  <Input
                    id="prazoMesesFin"
                    type="number"
                    value={prazoMesesFin}
                    onChange={(e) => setPrazoMesesFin(e.target.value)}
                    placeholder="60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxaFinanciamento">Taxa de Juros (% a.m.)</Label>
                  <Input
                    id="taxaFinanciamento"
                    type="number"
                    step="0.1"
                    value={taxaFinanciamento}
                    onChange={(e) => setTaxaFinanciamento(e.target.value)}
                    placeholder="2.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entrada">Entrada (%)</Label>
                  <Input
                    id="entrada"
                    type="number"
                    step="1"
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    placeholder="30"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rentabilidade das Opções (% a.m. equivalente)</Label>
                  <div className="rounded-md border bg-muted px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Consórcio</span>
                      <span className="font-semibold">
                        {(rentabilidadeConsorcio * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Financiamento</span>
                      <span className="font-semibold text-red-600">
                        {(rentabilidadeFinanciamento * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {tipoSimulacao === "consorcio" && (
              <div className="space-y-2">
                <Button onClick={handleSimular} className="w-full" size="lg">
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcular Simulação
                </Button>

                <Button
                  type="button"
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  size="lg"
                  onClick={() => {
                    // TODO: implementar geração real de PDF da simulação
                    console.log("Gerar PDF ainda não implementado")
                  }}
                >
                  Gerar PDF
                </Button>
              </div>
            )}
          </CardContent>
          </Card>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {showResults && (
            <motion.div
              key="results"
              layout="position"
              ref={resultadosRef}
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ duration: 0.45, ease: "easeInOut", type: "tween" }}
              className={showResults ? "lg:col-span-2 space-y-6" : "space-y-6"}
            >
              <div className="grid md:grid-cols-2 gap-4">
                {effectiveTipoSimulacao === "consorcio" ? (
                  <>
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 200 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      className="md:col-span-2"
                    >
                      <Card className="bg-primary text-primary-foreground">
                        <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <CreditCard className="w-5 h-5" />
                          <span>
                            {(nomeCliente && nomeCliente.trim()) || "Cliente"}, aqui você faz a melhor escolha de consórcio
                            para realizar o seu sonho.
                          </span>
                        </CardTitle>
                      </CardHeader>
                        <CardContent>
                        {simulacaoOficial ? (
                          <>
                            <div className="grid gap-6 items-baseline mb-2 xl:grid-cols-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0 text-3xl md:text-4xl font-bold">
                                  <span className="min-w-0 break-words">{formatCurrency(simulacaoOficial.valorParcela)}</span>
                                  <span className="whitespace-nowrap">/mês</span>
                                </div>
                                <p className="text-sm text-primary-foreground/80">
                                  Parcela inicial antes da contemplação
                                </p>
                              </div>
                              <div className="min-w-0 xl:text-right">
                                <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0 text-3xl md:text-4xl font-bold xl:justify-end">
                                  <span className="min-w-0 break-words">{formatCurrency(simulacaoOficial.parcelasAPagarValor)}</span>
                                  <span className="whitespace-nowrap">/mês</span>
                                </div>
                                <p className="text-sm text-primary-foreground/80">
                                  Após contemplação ({simulacaoOficial.parcelasAPagarQtd}x)
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-primary-foreground/80">
                              Total estimado do plano (aprox.): {formatCurrency(effectiveConsorcio.custoTotal)}
                            </p>

                            {/* Tempo de acumulação guardando a parcela do consórcio */}
                            {(() => {
                              const valorCartaTotal =
                                typeof effectiveConsorcio?.valorBem === "number" && Number.isFinite(effectiveConsorcio.valorBem)
                                  ? effectiveConsorcio.valorBem
                                  : parseCurrencyInput(valorBem)

                              const valorLanceEmbutido = simulacaoOficial.lanceEmbutidoValor
                              const temLanceEmbutido = valorLanceEmbutido > 0

                              const mesesCarta = calcularMesesAcumulacaoConsorcio(
                                effectiveConsorcio.parcelaMensal,
                                valorCartaTotal,
                              )

                              const mesesCreditoDisponivel = temLanceEmbutido
                                ? calcularMesesAcumulacaoConsorcio(
                                    effectiveConsorcio.parcelaMensal,
                                    valorCartaTotal,
                                    valorLanceEmbutido,
                                  )
                                : 0

                              if (!mesesCarta && !mesesCreditoDisponivel) return null

                              return (
                                <div
                                  id="tempo-acumulacao-consorcio"
                                  className="mt-3 rounded-md bg-primary-foreground/5 px-3 py-2 text-xs md:text-sm"
                                >
                                  <p className="font-semibold mb-1">Em quanto tempo sua parcela vira crédito?</p>
                                  {mesesCarta ? (
                                    <p>
                                      Guardando mensalmente o valor da parcela do consórcio, em{" "}
                                      <span className="font-semibold">{mesesCarta} meses</span> você acumularia o valor total do bem.
                                    </p>
                                  ) : null}
                                  {temLanceEmbutido && mesesCreditoDisponivel ? (
                                    <p className="mt-1">
                                      Considerando o lance embutido, em{" "}
                                      <span className="font-semibold">{mesesCreditoDisponivel} meses</span> você acumularia o valor do
                                      crédito disponível.
                                    </p>
                                  ) : null}
                                </div>
                              )
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="text-4xl font-bold mb-2">{formatCurrency(effectiveConsorcio.parcelaMensal)}/mês</div>
                            <p className="text-sm text-primary-foreground/80">
                              Total: {formatCurrency(effectiveConsorcio.custoTotal)}
                            </p>
                          </>
                        )}
                        {effectiveConsorcio.valorLance > 0 && (
                          <div className="mt-2 pt-2 border-t border-primary-foreground/20 space-y-1">
                            {effectiveConsorcio.tipoLance === "livre" && (
                              <p className="text-sm text-primary-foreground/90">
                                Lance Livre: {formatCurrency(effectiveConsorcio.valorLanceLivre)}
                              </p>
                            )}
                            {effectiveConsorcio.tipoLance === "embutido" && (
                              <p className="text-sm text-primary-foreground/90">
                                Lance Embutido: {formatCurrency(effectiveConsorcio.valorLanceEmbutido)}
                              </p>
                            )}
                            {effectiveConsorcio.tipoLance === "ambos" && (
                              <>
                                <p className="text-sm text-primary-foreground/90">
                                  Lance Livre: {formatCurrency(effectiveConsorcio.valorLanceLivre)}
                                </p>
                                <p className="text-sm text-primary-foreground/90">
                                  Lance Embutido: {formatCurrency(effectiveConsorcio.valorLanceEmbutido)}
                                </p>
                              </>
                            )}
                          </div>
                        )}
                        </CardContent>
                      </Card>
                    </motion.div>

                    {simulacaoOficial && (
                      <>
                        <Card className="md:col-span-2 border-emerald-500/70 bg-emerald-50">
                          <CardContent className="py-4 grid md:grid-cols-3 gap-4 text-sm md:text-base">
                            <div className="space-y-1">
                              <p className="font-semibold text-emerald-900/90 text-xs md:text-sm uppercase tracking-wide">
                                Saldo Devedor
                              </p>
                              <p className="text-lg md:text-2xl font-bold text-emerald-900/90">
                                {formatCurrency(simulacaoOficial.saldoDevedor)}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="font-semibold text-emerald-900/90 text-xs md:text-sm uppercase tracking-wide">
                                Qtd Parcelas Pagas
                              </p>
                              <p className="text-lg md:text-2xl font-bold text-emerald-900/90">
                                {simulacaoOficial.parcContem}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="font-semibold text-emerald-900/90 text-xs md:text-sm uppercase tracking-wide">
                                Parcelas a Pagar
                              </p>
                              <p className="text-emerald-900/90 text-sm md:text-base">
                                <span className="font-semibold text-emerald-900">
                                  {simulacaoOficial.parcelasAPagarQtd}x
                                </span>{" "}
                                de
                                {" "}
                                <span className="font-semibold">
                                  {formatCurrency(simulacaoOficial.parcelasAPagarValor)}
                                </span>
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="md:col-span-2 border-sky-500/70 bg-sky-50 mt-2 shadow-sm">
                          <CardContent className="py-3 grid md:grid-cols-3 gap-4 text-xs md:text-sm">
                            <div className="space-y-1">
                              <p className="font-semibold text-sky-900">Lance Ofertado (R$)</p>
                              <p className="text-base md:text-xl font-extrabold text-sky-900">
                                {formatCurrency(simulacaoOficial.lanceOfertadoValor)}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="font-semibold text-sky-900">Lance Embutido (R$)</p>
                              <p className="text-base md:text-xl font-extrabold text-sky-900">
                                {formatCurrency(simulacaoOficial.lanceEmbutidoValor)}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="font-semibold text-sky-900">Lance Pago em Dinheiro (R$)</p>
                              <p className="text-base md:text-xl font-extrabold text-sky-900">
                                {formatCurrency(
                                  Math.max(
                                    0,
                                    simulacaoOficial.lanceOfertadoValor - simulacaoOficial.lanceEmbutidoValor,
                                  ),
                                )}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}

                    <Card className="bg-muted">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Wallet className="w-4 h-4" />À Vista (Poupança)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-1">{formatCurrency(effectiveAVista.parcelaMensal)}/mês</div>
                        <p className="text-xs text-muted-foreground">Total: {formatCurrency(effectiveAVista.custoTotal)}</p>
                        <p className="text-xs text-amber-600 mt-1">⚠️ Requer muita disciplina</p>
                      </CardContent>
                    </Card>

                    {simulacaoOficial && (
                      <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-900">
                            <TrendingUp className="w-4 h-4" />
                            Crédito Disponível
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold mb-1 text-foreground">
                              {formatCurrency(simulacaoOficial.creditoDisponivel)}
                            </div>
                            <p className="text-xs text-emerald-900/80 uppercase tracking-wide">
                              Crédito Disponível
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <>
                    <Card className="bg-secondary text-secondary-foreground md:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <CreditCard className="w-5 h-5" />
                          Financiamento - Bem Imediato
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold mb-2">{formatCurrency(effectiveFinanciamento.parcelaMensal)}/mês</div>
                        <p className="text-sm text-secondary-foreground/80">
                          Total: {formatCurrency(effectiveFinanciamento.custoTotal)}
                        </p>
                        <p className="text-sm text-red-600 mt-1">⚠️ Juros: {formatCurrency(effectiveFinanciamento.jurosTotal)}</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Wallet className="w-4 h-4" />À Vista (Poupança)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-1">{formatCurrency(effectiveAVista.parcelaMensal)}/mês</div>
                        <p className="text-xs text-muted-foreground">Total: {formatCurrency(effectiveAVista.custoTotal)}</p>
                        <p className="text-xs text-amber-600 mt-1">⚠️ Espera até o final</p>
                      </CardContent>
                    </Card>

                    {simulacaoOficial && (
                      <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-900">
                            <TrendingUp className="w-4 h-4" />
                            Crédito Disponível (Planilha)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1">
                            <p className="font-semibold text-emerald-900/80 text-[0.7rem] md:text-xs uppercase tracking-wide">
                              Crédito Disponível
                            </p>
                            <p className="inline-flex items-center rounded-full bg-gradient-to-br from-emerald-50/60 via-emerald-500/10 to-emerald-700/10 text-emerald-900 px-4 py-1.5 text-sm md:text-base font-extrabold shadow-md border border-emerald-300/70 ring-1 ring-emerald-800/10 backdrop-blur-md">
                              {formatCurrency(simulacaoOficial.creditoDisponivel)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>

              <ComparisonResults
                consorcio={{
                  ...effectiveConsorcio,
                  ...(typeof simulacaoOficial?.valorParcela === "number" && Number.isFinite(simulacaoOficial.valorParcela)
                    ? { parcelaAntesContemplacao: simulacaoOficial.valorParcela }
                    : {}),
                }}
                financiamento={effectiveFinanciamento}
                aVista={effectiveAVista}
                outros={effectiveOutros}
                tipoSimulacao={effectiveTipoSimulacao}
              />

              {simulacaoOficial && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Resumo da Simulação Oficial (Planilha)</CardTitle>
                    <CardDescription>
                      Valores calculados com a mesma lógica da planilha Servopa (calculateSimulation).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="font-semibold">Parcela Inicial</p>
                      <p>{formatCurrency(simulacaoOficial.valorParcela)}</p>
                      <p className="text-xs text-muted-foreground">
                        % da Parcela: {percentualParcelaOficial?.toFixed(4).replace(".", ",")}%
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-semibold">Após Contemplação</p>
                      <p>Saldo Devedor: {formatCurrency(simulacaoOficial.saldoDevedor)}</p>
                      <p>
                        Parcelas a Pagar: {simulacaoOficial.parcelasAPagarQtd}x de {" "}
                        {formatCurrency(simulacaoOficial.parcelasAPagarValor)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Parcelas já consideradas pagas: {simulacaoOficial.parcContem}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-semibold">Lance e Crédito</p>
                      <p>Lance Ofertado: {formatCurrency(simulacaoOficial.lanceOfertadoValor)}</p>
                      <p>Lance Embutido: {formatCurrency(simulacaoOficial.lanceEmbutidoValor)}</p>
                      <p>Crédito Disponível: {formatCurrency(simulacaoOficial.creditoDisponivel)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Rentabilidade se você NÃO usar a carta de crédito
                  </CardTitle>
                  <CardDescription>
                    Compare deixar o valor da carta de crédito parado no consórcio com investir o mesmo valor em CDB ou
                    poupança.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">Carta de Crédito (não utilizada)</p>
                    <p>
                      Valor inicial: {formatCurrency(valorCarta)}
                    </p>
                    <p>
                      Valor ao final: {formatCurrency(cartaParada.valorFinal)}
                    </p>
                    <p className="text-emerald-700">
                      Ganho: {formatCurrency(cartaParada.ganho)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Taxa considerada: {(TAXA_CARTA_CREDITO_PADRAO).toFixed(2)}% a.m.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">Investindo em CDB</p>
                    <p>
                      Valor inicial: {formatCurrency(valorCarta)}
                    </p>
                    <p>
                      Valor ao final: {formatCurrency(investimentoCdb.valorFinal)}
                    </p>
                    <p className="text-emerald-700">
                      Ganho: {formatCurrency(investimentoCdb.ganho)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Taxa considerada: {(TAXA_CDB_PADRAO).toFixed(2)}% a.m.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">Investindo na Poupança</p>
                    <p>
                      Valor inicial: {formatCurrency(valorCarta)}
                    </p>
                    <p>
                      Valor ao final: {formatCurrency(investimentoPoupanca.valorFinal)}
                    </p>
                    <p className="text-emerald-700">
                      Ganho: {formatCurrency(investimentoPoupanca.ganho)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Taxa considerada: {(RENDIMENTO_POUPANCA_PADRAO).toFixed(2)}% a.m.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
