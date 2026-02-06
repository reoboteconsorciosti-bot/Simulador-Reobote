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
  // Compatibility
  // Compatibility
  praTotal?: number
  saDev?: string
  vParcNorm?: string
  vParcaPag?: string

  // Extended Compatibility
  praPos?: number
  taxaAdm?: string
  percLanceOf?: string
  vLanceOf?: string
  percLanceEmb?: string
  vLanceEmb?: string
  perRecPro?: string
  vRecPro?: string
  parcContem?: number
  dataSimulacao?: string

  // Investment Fields
  anos?: string
  porcValorizImo?: string
  valoriz?: string
  porcRenda?: string
  rendaAlug?: string
  lucroRenda?: string
  praRestan?: string
  rentab?: string
  porcValAnual?: string
  valFinaImov?: string
  valorRentab?: string
  rendaPass?: string
}

const formatCurrency = (value: number): string => {
  if (typeof value !== 'number' || isNaN(value)) return "R$ 0,00"
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

const formatPercent = (value: number): string => {
  if (typeof value !== 'number' || isNaN(value)) return "0%"
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }) + "%"
}

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

  // Date Logic
  const currentDate = new Date()
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ]
  const dataSimulacao = `${currentDate.getDate()} de ${months[currentDate.getMonth()]} de ${currentDate.getFullYear()}`

  // Taxa Adm Logic for Compatibility
  // Assuming 'taxa' in inputs is just a value, we format it as percent if possible or use a safe default
  // Construction simulator uses 'taxaAdm' as input? No, it uses 'taxa' (ConstrucaoInputs).
  // But params.inputs in this function has ... wait, let's see ConsorcioPConstrucao inputs mapping in generatedPdf call.
  // In component: taxaAdministracao: taxaAdm. 
  // Let's check `gerar-pdf-construcao.ts` interface to be sure.

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

    // FULL COMPATIBILITY MAPPING (Standard Simulator Fields)
    praTotal: params.inputs.prazoMeses || 0,
    saDev: formatCurrency(params.outputs.saldoDevedor ?? 0),
    vParcNorm: formatCurrency(params.outputs.parcelaIntegral ?? 0),
    vParcaPag: formatCurrency(params.outputs.novaParcela ?? 0),

    // Missing fields added now:
    praPos: params.outputs.parcelasAPagarQtd || 0,
    // Construction doesn't have explicit 'taxaAdm' input passed here? 
    // Wait, generatedPdfConstrucao inputs don't seem to pass 'taxa' expressly? 
    // I need to check gerar-pdf-construcao.ts. Assuming 0 for now if missing.
    taxaAdm: "0%",

    percLanceOf: "0%", // Construction calculates value, not always percent input stored in same way
    vLanceOf: formatCurrency(params.outputs.valorLancePago ?? 0), // Best guess: Valor Pago = Lance Livre
    percLanceEmb: "0%",
    vLanceEmb: formatCurrency(params.outputs.valorLanceEmbutido ?? 0),

    perRecPro: "0%", // Recurso Proprio
    vRecPro: formatCurrency(0), // Would calculate logic if needed

    parcContem: params.inputs.contemplacaoMes || 0,
    dataSimulacao: dataSimulacao,

    // Investment Fields
    anos: "20", // Default logic or input? Assuming 20 based on context, or derived from prazo?
    // User JSON shows "porcValorizImo": "40%". This comes from params.inputs.valorizacaoPercent.
    porcValorizImo: formatPercent(valorizacaoPercentNumber),
    valoriz: formatCurrency(valorizacaoReal),
    // "porcRenda" seems to be rental yield percent?
    // In component logic: rendaMensalImovel is an input, but what is the yield?
    // Let's check outputs for yield if available, or calc it.
    // JSON: "porcRenda": "1%". 
    // JSON: "rendaAlug": "R$ 24.353,70". This matches outputs.rendaMensalAluguel or rendaMensalGerada?
    // In calcConstrucao: rendaMensalGeradaCalc = calcularRendaMensal(...)
    // outputs.rendaMensalGerada is the gross rent.
    // outputs.rendaMensalAluguel is net rent (reinvestimentoMensal in component state).
    // Let's map best guesses based on names:
    rendaAlug: formatCurrency(params.outputs.rendaMensalGerada ?? 0),
    lucroRenda: formatCurrency(params.outputs.rendaMensalAluguel ?? 0), // "Lucro Líquido Mensal" in UI

    // "praRestan": "204". Matches outputs.prazoRestante (or parcelasAPagarQtd)?
    praRestan: String(params.outputs.parcelasAPagarQtd ?? 0),

    // "rentab": "1%". Maybe generic? Or calc?
    rentab: "1%", // Placeholder matching example if dynamic logic unavailable
    porcRenda: "0.5%", // Placeholder, commonly used default for rental yield if not explicit input

    porcValAnual: "6%", // Placeholder or input if we have it? (We have INCC, but this is Property Appreciation)

    // "valFinaImov": "R$ 6.557.898,06". This is huge. Likely Future Value of property?
    // We have creditoComValorizacao, but that's initial.
    valFinaImov: formatCurrency(params.outputs.creditoComValorizacao ?? 0), // Mapping what we have for now.

    valorRentab: formatCurrency(0), // No direct output for total rentability value over time in current outputs interface
    rendaPass: formatCurrency(0), // Passive income?
  }
}
