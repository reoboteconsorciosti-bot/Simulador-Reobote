import { SimulationOutputs } from "./calculate-simulation"

export interface WebhookPayload {
    nome: string
    consultor: string
    credIndic: string
    credDisp: string
    saDev: string
    praTotal: number
    praPos: number
    vParcaPag: string
    vParcNorm: string
    taxaAdm: string
    percLanceOf: string
    vLanceOf: string
    percLanceEmb: string
    vLanceEmb: string
    perRecPro: string
    vRecPro: string
    parcContem: number
    dataSimulacao: string
    tipoBem: string
}

const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    })
}

const formatPercent = (value: number): string => {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
    }) + "%"
}

// Helper to parse currency string back to number if needed, or use the raw inputs/outputs
const parseCurrencyString = (value: string): number => {
    if (!value) return 0
    const cleaned = value.replace(/[^0-9.,]/g, "").trim()
    if (!cleaned) return 0
    const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".")
    const n = Number(normalized)
    return Number.isFinite(n) ? n : 0
}

export function formatProposalPayload(
    inputs: {
        nomeCliente: string
        nomeConsultor: string
        valorBem: string | number
        prazoMeses: string | number
        taxaAdministracao: string | number
        percentualOfertado: string | number
        percentualEmbutido: string | number
        tipoBem: string
    },
    outputs: SimulationOutputs
): WebhookPayload {
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

    // Ensure numeric values from inputs
    const taxaAdmVal = Number(inputs.taxaAdministracao) || 0
    const percLanceOfVal = Number(inputs.percentualOfertado) || 0
    const percLanceEmbVal = Number(inputs.percentualEmbutido) || 0

    // Recurso Próprio % = Lance Ofertado % - Lance Embutido %
    const percRecProVal = Math.max(0, percLanceOfVal - percLanceEmbVal)

    // Recurso Próprio R$ = Lance Ofertado R$ - Lance Embutido R$
    const vRecProVal = Math.max(0, outputs.lanceOfertadoValor - outputs.lanceEmbutidoValor)

    const valorCreditoIndicado = typeof inputs.valorBem === 'string'
        ? parseCurrencyString(inputs.valorBem)
        : inputs.valorBem

    return {
        nome: inputs.nomeCliente || "Cliente",
        consultor: inputs.nomeConsultor || "Consultor",
        credIndic: formatCurrency(valorCreditoIndicado),
        credDisp: formatCurrency(outputs.creditoDisponivel),
        saDev: formatCurrency(outputs.saldoDevedor),
        praTotal: Number(inputs.prazoMeses) || 0,
        praPos: outputs.parcelasAPagarQtd,
        vParcaPag: formatCurrency(outputs.parcelasAPagarValor),
        vParcNorm: formatCurrency(outputs.valorParcela),
        taxaAdm: formatPercent(taxaAdmVal),
        percLanceOf: formatPercent(percLanceOfVal),
        vLanceOf: formatCurrency(outputs.lanceOfertadoValor),
        percLanceEmb: formatPercent(percLanceEmbVal),
        vLanceEmb: formatCurrency(outputs.lanceEmbutidoValor),
        perRecPro: formatPercent(percRecProVal),
        vRecPro: formatCurrency(vRecProVal),
        parcContem: outputs.parcContem,
        dataSimulacao,
        tipoBem: formatTipoBem(inputs.tipoBem),
    }
}

function formatTipoBem(tipo: string): string {
    const map: Record<string, string> = {
        imovel: "Imóvel",
        automovel: "Automóvel",
    }
    return map[tipo.toLowerCase()] || (tipo.charAt(0).toUpperCase() + tipo.slice(1))
}
