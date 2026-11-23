import { formatProposalPayload } from "./proposal-formatter"
import type { SimulationOutputs } from "./calculate-simulation"

export async function gerarPdfPadrao(params: {
  inputs: {
    nomeCliente: string
    nomeConsultor: string
    valorBem: string | number
    prazoMeses: string | number
    taxaAdministracao: string | number
    percentualOfertado: string | number
    percentualEmbutido: string | number
    tipoBem: string
  }
  outputs: SimulationOutputs
}): Promise<Response> {
  const payload = formatProposalPayload(params.inputs, params.outputs)

  // [DESATIVADO] Fluxo antigo: enviava o payload ao webhook (n8n/Make) via /api/webhook/proposal.
  // return fetch("/api/webhook/proposal", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // })

  // Novo fluxo: o servidor preenche designerProposta/automovel e devolve o PDF temporário.
  return fetch("/api/proposal/pdf?tipo=automovel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}
