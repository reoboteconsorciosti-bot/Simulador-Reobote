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
    porcRenda: string
    valorRentab?: number
    rendaPass?: number
    tipoBem: string
    rentab?: string
  }
  outputs: ConstrucaoOutputs
}): Promise<Response> {
  const payload = formatProposalPayloadConstrucao(params)

  // [DESATIVADO] Fluxo antigo: enviava o payload ao webhook (n8n/Make) via /api/webhook/proposal-construcao.
  // return fetch("/api/webhook/proposal-construcao", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // })

  // Novo fluxo: o servidor preenche designerProposta/construcao e devolve o PDF temporário.
  return fetch("/api/proposal/pdf?tipo=construcao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}
