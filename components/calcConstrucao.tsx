export interface ConstrucaoInputs {
    credito: number
    prazo: number
    taxa: number
    incc: number
    contemplacao: number
    reajuste: "anual" | "semestral"
}

export interface ConstrucaoOutputs {
    parcelaIntegral: number
    creditoAtualizado: number
    novaParcela: number
    historicoReajustes: Array<{ mes: number; valor: number }>
    contemplacaoMes: number
    tipoReajuste: "anual" | "semestral"

    // Novos campos para compatibilidade com o UI
    custoTotal: number
    saldoDevedor: number
    qtdParcelasPagas: number
    parcelasAPagarQtd: number
    valorLanceTotal: number
    valorLanceEmbutido: number
    valorLancePago: number
    creditoDisponivel: number
    prazoRestante: number
    valorizacaoReal?: number // Novo campo
    creditoComValorizacao?: number // Novo campo
    rendaMensalImovel?: number // Novo campo
    reinvestimentoMensal?: number // Novo campo
    modoContemplacao?: string // Novo campo
    inputs: ConstrucaoInputs // Repassando inputs para referência
}

/**
 * Calcula a valorização sobre o bem
 * @param creditoAtualizado Valor do crédito já com reajustes do INCC
 * @param percentualValorizacao Percentual de valorização (ex: 20 para 20%)
 * @returns Valor monetário da valorização
 */
export function calcularValorizacao(creditoAtualizado: number, percentualValorizacao: number): number {
    return creditoAtualizado * (percentualValorizacao / 100)
}

/**
 * 1) Parcela Integral
 * ParcelaIntegral = (CreditoDoConsorcio / Prazo) * (1 + Taxa/100)
 */
export function calcularParcelaIntegral(credito: number, prazo: number, taxa: number): number {
    if (prazo <= 0) {
        throw new Error("O prazo deve ser maior que 0")
    }
    return (credito / prazo) * (1 + taxa / 100)
}

/**
 * 2) Crédito atualizado na contemplação
 * Simulação temporal iterativa (mês a mês)
 */
export function calcularCreditoAtualizado(
    credito: number,
    incc: number,
    contemplacao: number,
    reajuste: "anual" | "semestral"
): { valorFinal: number; historico: Array<{ mes: number; valor: number }> } {
    let valorAtual = credito
    const historico: Array<{ mes: number; valor: number }> = []

    // Histórico inicial (mês 0)
    historico.push({ mes: 0, valor: valorAtual })

    for (let mes = 1; mes <= contemplacao; mes++) {
        let aplicouReajuste = false

        if (reajuste === "semestral" && mes % 6 === 0) {
            valorAtual = valorAtual * (1 + incc / 100)
            aplicouReajuste = true
        } else if (reajuste === "anual" && mes % 12 === 0) {
            valorAtual = valorAtual * (1 + incc / 100)
            aplicouReajuste = true
        }

        if (aplicouReajuste) {
            historico.push({ mes, valor: valorAtual })
        }
    }

    return {
        valorFinal: valorAtual,
        historico,
    }
}

/**
 * 3) Nova parcela recalculada
 * NovaParcela = (CreditoAtualizadoNaContemplacao / Prazo) + Taxa
 */
export function calcularNovaParcela(creditoAtualizado: number, prazo: number, taxa: number): number {
    if (prazo <= 0) {
        throw new Error("O prazo deve ser maior que 0")
    }
    return (creditoAtualizado / prazo) * (1 + taxa / 100)
}

/**
 * Função Principal que orquestra os cálculos
 */
export function calcularConstrucao(inputs: ConstrucaoInputs): ConstrucaoOutputs {
    const { credito, prazo, taxa, incc, contemplacao, reajuste } = inputs

    const parcelaIntegral = calcularParcelaIntegral(credito, prazo, taxa)

    const { valorFinal: creditoAtualizado, historico } = calcularCreditoAtualizado(
        credito,
        incc,
        contemplacao,
        reajuste
    )

    const novaParcela = calcularNovaParcela(creditoAtualizado, prazo, taxa)

    // Cálculos derivados para o UI
    const custoTotal = parcelaIntegral * prazo
    const qtdParcelasPagas = contemplacao
    const parcelasAPagarQtd = Math.max(0, prazo - qtdParcelasPagas)
    const saldoDevedor = novaParcela * parcelasAPagarQtd

    // Sem lance nessa etapa
    const valorLanceTotal = 0
    const valorLanceEmbutido = 0
    const valorLancePago = 0
    const creditoDisponivel = creditoAtualizado // Sem lance embutido para deduzir

    return {
        parcelaIntegral,
        creditoAtualizado,
        novaParcela,
        historicoReajustes: historico,
        contemplacaoMes: contemplacao,
        tipoReajuste: reajuste,

        custoTotal,
        saldoDevedor,
        qtdParcelasPagas,
        parcelasAPagarQtd,
        valorLanceTotal,
        valorLanceEmbutido,
        valorLancePago,
        creditoDisponivel,
        prazoRestante: parcelasAPagarQtd,
        inputs
    }
}
