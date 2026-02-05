import type { ConstrucaoOutputs } from "@/components/calcConstrucao"
import { formatProposalPayloadConstrucao } from "./proposal-formatter-construcao"

export async function gerarPdfConstrucao(params: {
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
}): Promise<Response> {
  const payload = formatProposalPayloadConstrucao(params)

  return fetch("/api/webhook/proposal-construcao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}
