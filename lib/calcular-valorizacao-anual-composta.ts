export type HistoricoValorizacaoAnual = Array<{ ano: number; valor: number }>

export function calcularValorizacaoAnualComposta(params: {
  valorInicial: number
  percentualAnual: number
  anos: number
}): { valorFinal: number; historico: HistoricoValorizacaoAnual } {
  const valorInicial = Number(params.valorInicial) || 0
  const percentualAnual = Number(params.percentualAnual) || 0
  const anos = Math.max(0, Math.floor(Number(params.anos) || 0))

  let valorAtual = valorInicial
  const historico: HistoricoValorizacaoAnual = []

  for (let ano = 1; ano <= anos; ano++) {
    valorAtual = valorAtual * (1 + percentualAnual / 100)
    historico.push({ ano, valor: valorAtual })
  }

  return { valorFinal: valorAtual, historico }
}
