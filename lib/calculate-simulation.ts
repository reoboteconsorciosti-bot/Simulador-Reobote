export interface SimulationInputs {
  clienteNome: string
  consultorNome: string
  tipoBem: "Imóvel" | "Automóvel"
  credito: number | ""
  qtdMeses: number | ""
  taxa: number | ""
  planoLight: number
  seguroPrestamista: number
  percentualOfertado: number | ""
  percentualEmbutido: number | ""
  qtdParcelasOfertado: number
  diluirLance: number
  lanceNaAssembleia: number | ""
}

export interface SimulationOutputs {
  valorParcela: number
  creditoDisponivel: number
  saldoDevedor: number
  parcelasAPagarQtd: number
  parcelasAPagarValor: number
  lanceOfertadoValor: number
  lanceEmbutidoValor: number
  percentualParcela: number
  parcContem: number
}

const L16_CONST = 0.000599
const L17_CONST = 0.000392

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

function ifError(fn: () => number, fallback: number): number {
  try {
    const v = fn()
    if (Number.isNaN(v) || !Number.isFinite(v)) return fallback
    return v
  } catch {
    return fallback
  }
}

export function calculateSimulation(inputs: SimulationInputs): SimulationOutputs | null {
  const credito = Number(inputs.credito) || 0
  const qtdMeses = Number(inputs.qtdMeses) || 0
  const taxa = Number(inputs.taxa) || 0
  const percentualOfertado = Number(inputs.percentualOfertado) || 0
  const percentualEmbutido = Number(inputs.percentualEmbutido) || 0
  const qtdParcelasOfertado = Number(inputs.qtdParcelasOfertado) || 0
  const lanceNaAssembleia = Number(inputs.lanceNaAssembleia) || 0
  const { planoLight, seguroPrestamista } = inputs
  const diluirLance = Number(inputs.diluirLance)

  if (qtdMeses === 0) {
    return null
  }

  const taxaDecimal = taxa / 100
  const percentualOfertadoDecimal = percentualOfertado / 100
  const percentualEmbutidoDecimal = percentualEmbutido / 100

  const getPlanoLightFactor = (planoLightValue: number): number => {
    switch (planoLightValue) {
      case 2:
        return 0.9
      case 3:
        return 0.8
      case 4:
        return 0.7
      case 5:
        return 0.6
      case 6:
        return 0.5
      case 1:
      default:
        return 1.0
    }
  }

  const planoLightFactor = getPlanoLightFactor(planoLight)

  const N13 = 1 + taxaDecimal
  const N14 = round(N13 / qtdMeses, 6)
  const N12 = credito * N13

  const isAutomovel = seguroPrestamista === 1
  const isImovel = seguroPrestamista === 2

  const N27_flag = isAutomovel ? 1 : 0
  const N28_flag = 0

  const L14_seguro_vida = L16_CONST * N12 * N27_flag
  const L15_seguro_garantia = L17_CONST * N12 * N28_flag

  const B10_parcela_porcentagem = round(N14 * planoLightFactor, 8)
  const C10_valorParcela = credito * B10_parcela_porcentagem + L14_seguro_vida + L15_seguro_garantia

  const O12 = ifError(() => round((lanceNaAssembleia * B10_parcela_porcentagem * credito) / credito, 6), 0)
  const O14 = qtdMeses - lanceNaAssembleia
  const O13 = N13 - O12
  const O15 = ifError(() => round(O13 / O14, 6), 0)
  const O16 = round(credito * O15, 6)

  let totalBidParcels = 0
  let C19_lance_ofertado_val = 0

  if (percentualOfertadoDecimal > 0) {
    const rawParcels = ((credito * N13) * percentualOfertadoDecimal) / O16
    // Usa arredondamento para o inteiro mais próximo, conforme especificação original da planilha
    totalBidParcels = round(rawParcels, 0)
    C19_lance_ofertado_val = totalBidParcels * O16
  } else {
    C19_lance_ofertado_val = qtdParcelasOfertado * O16
    totalBidParcels = qtdParcelasOfertado
  }

  const L21 = ifError(() => ((credito * N13) * percentualEmbutidoDecimal) / O16, 0)
  // Mesma regra de arredondamento para a quantidade de parcelas embutidas
  const D20_qtd_parcelas_embutido = round(L21, 0)
  const C20_lance_embutido_val = D20_qtd_parcelas_embutido * O16

  const cashParcels = totalBidParcels - D20_qtd_parcelas_embutido

  const B30_creditoDisponivel = credito - C20_lance_embutido_val

  // Regra de negócio: sempre que houver lance > 0, ele deve representar parcelas abatidas
  // na contagem de "qtd parcelas pagas" / "parcelas a pagar". A forma de abatimento
  // (diluirLance) só altera se há redução de prazo ou apenas de valor, mas **não pode**
  // zerar o abatimento quando houver lance.
  let parcelasAbatidas = 0
  if (totalBidParcels > 0) {
    if (diluirLance === 2) {
      // 2 - LUDC – segue regra atual de não abater prazo na contagem de parcelas
      parcelasAbatidas = 0
    } else if (diluirLance === 1) {
      // 1 - Sim (Abater Prazo) -> Usuário pediu para abater a QTD DE PARCELAS CONFORME O LANCE EMBUTIDO
      parcelasAbatidas = D20_qtd_parcelas_embutido
    } else {
      // 3 - Não (Abater Parcelas) -> Abate pelo total de parcelas do lance (Embutido + Livre)
      parcelasAbatidas = totalBidParcels
    }
  }

  const B28_qtd_parcelas_pagas = 1 + parcelasAbatidas + (lanceNaAssembleia - 1)
  const B29_parcelasAPagarQtd = qtdMeses - B28_qtd_parcelas_pagas

  const L27 = (cashParcels + D20_qtd_parcelas_embutido) * O15 + O12
  const L28 = N13 - L27
  const B27_saldoDevedor = L28 * credito

  const L29 = ifError(() => round(L28 / B29_parcelasAPagarQtd, 6), 0)

  const M27_seguro_vida_pos = L16_CONST * B27_saldoDevedor * (isAutomovel ? 1 : 0)
  const M28_seguro_garantia_pos = L17_CONST * B27_saldoDevedor * (isImovel ? 1 : 0)

  const C29_parcelasAPagarValor = ifError(
    () => L29 * credito + M27_seguro_vida_pos + M28_seguro_garantia_pos,
    0,
  )

  return {
    valorParcela: C10_valorParcela,
    creditoDisponivel: B30_creditoDisponivel,
    saldoDevedor: B27_saldoDevedor,
    parcelasAPagarQtd: B29_parcelasAPagarQtd,
    parcelasAPagarValor: C29_parcelasAPagarValor,
    lanceOfertadoValor: C19_lance_ofertado_val,
    lanceEmbutidoValor: C20_lance_embutido_val,
    percentualParcela: B10_parcela_porcentagem,
    parcContem: B28_qtd_parcelas_pagas,
  }
}
