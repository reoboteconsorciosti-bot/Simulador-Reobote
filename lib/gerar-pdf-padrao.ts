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

  return fetch("/api/webhook/proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}
