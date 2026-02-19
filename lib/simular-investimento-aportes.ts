export type HistoricoInvestimentoMensal = Array<{ mes: number; saldo: number }>

const roundCents = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function simularInvestimentoComAportes(params: {
  aporteMensal: number
  taxaMensal: number // decimal: 0.01 = 1% a.m.
  totalMeses: number
  gerarHistorico?: boolean
}): { valorFinal: number; historico?: HistoricoInvestimentoMensal } {
  const aporteMensal = Number(params.aporteMensal) || 0
  const taxaMensal = Number(params.taxaMensal)
  const totalMeses = Math.max(0, Math.floor(Number(params.totalMeses) || 0))
  const gerarHistorico = Boolean(params.gerarHistorico)

  if (!Number.isFinite(taxaMensal) || taxaMensal < 0 || taxaMensal > 1) {
    return { valorFinal: 0, historico: gerarHistorico ? [] : undefined }
  }

  let saldo = 0
  const historico: HistoricoInvestimentoMensal = []

  for (let mes = 1; mes <= totalMeses; mes++) {
    const saldoAntesJuros = roundCents(saldo + aporteMensal)
    const saldoDepoisJuros = roundCents(saldoAntesJuros * (1 + taxaMensal))

    saldo = saldoDepoisJuros

    if (gerarHistorico) {
      historico.push({ mes, saldo })
    }
  }

  return {
    valorFinal: saldo,
    historico: gerarHistorico ? historico : undefined,
  }
}
