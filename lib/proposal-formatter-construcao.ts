import type { ConstrucaoOutputs } from "@/components/calcConstrucao"

export interface WebhookPayloadConstrucao {
  nome: string
  consultor: string
  credIndic: string
  credAtualizado: string
  credDisp: string
  prazoMeses: number
  contemplacaoMes: number
  parcelaIntegral: string
  novaParcela: string
  saldoDevedor: string
  valorLanceTotal: string
  valorLanceEmbutido: string
  valorLancePago: string
  modoContemplacao: string
  planoReducao: string
  seguroPrestamista: string
  formaAbatimento: string
  valorizacaoPercent: string
  valorizacaoReal: string
  creditoComValorizacao: string
  tipoBem: string
}

const formatCurrency = (value: number): string =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })

const formatPercent = (value: number): string =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }) + "%"

const formatTipoBem = (tipoBem: string): string => {
  if (tipoBem === "imovel") return "Imóvel"
  if (tipoBem === "automovel") return "Automóvel"
  if (tipoBem === "construcao") return "construcao"
  return tipoBem
}

export function formatProposalPayloadConstrucao(params: {
  inputs: {
    nomeCliente: string
    nomeConsultor: string
    credito: number
    prazoMeses: number
    contemplacaoMes: number
    modoContemplacao: string
    planoReducao: string | number
    seguroPrestamista: string | number
    formaAbatimento: string | number
    valorizacaoPercent: string | number
    tipoBem: string
  }
  outputs: ConstrucaoOutputs
}): WebhookPayloadConstrucao {
  const creditoIndicado = params.inputs.credito
  const credAtualizado = params.outputs.creditoAtualizado ?? 0
  const credDisp = params.outputs.creditoDisponivel ?? credAtualizado

  const valorizacaoPercentNumber = Number(params.inputs.valorizacaoPercent) || 0
  const valorizacaoReal = params.outputs.valorizacaoReal ?? 0
  const creditoComValorizacao = params.outputs.creditoComValorizacao ?? 0

  return {
    nome: params.inputs.nomeCliente || "Cliente",
    consultor: params.inputs.nomeConsultor || "Consultor",
    credIndic: formatCurrency(creditoIndicado),
    credAtualizado: formatCurrency(credAtualizado),
    credDisp: formatCurrency(credDisp),
    prazoMeses: params.inputs.prazoMeses || 0,
    contemplacaoMes: params.inputs.contemplacaoMes || 0,
    parcelaIntegral: formatCurrency(params.outputs.parcelaIntegral ?? 0),
    novaParcela: formatCurrency(params.outputs.novaParcela ?? 0),
    saldoDevedor: formatCurrency(params.outputs.saldoDevedor ?? 0),
    valorLanceTotal: formatCurrency(params.outputs.valorLanceTotal ?? 0),
    valorLanceEmbutido: formatCurrency(params.outputs.valorLanceEmbutido ?? 0),
    valorLancePago: formatCurrency(params.outputs.valorLancePago ?? 0),
    modoContemplacao: params.inputs.modoContemplacao || "sorteio",
    planoReducao: String(params.inputs.planoReducao ?? ""),
    seguroPrestamista: String(params.inputs.seguroPrestamista ?? ""),
    formaAbatimento: String(params.inputs.formaAbatimento ?? ""),
    valorizacaoPercent: formatPercent(valorizacaoPercentNumber),
    valorizacaoReal: formatCurrency(valorizacaoReal),
    creditoComValorizacao: formatCurrency(creditoComValorizacao),
    tipoBem: "Construção",
  }
}
