"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Check, X, TrendingDown, TrendingUp, AlertCircle, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/formatters"

interface ComparisonData {
  parcelaMensal: number
  custoTotal: number
  valorBem: number
}

interface ConsorcioData extends ComparisonData {
  taxaAdminTotal: number
  fundoReservaTotal: number
  parcelaAntesContemplacao?: number
}

interface FinanciamentoData extends ComparisonData {
  valorEntrada: number
  jurosTotal: number
}

interface AVistaData extends ComparisonData {
  economizado: number
  disciplinaRequerida?: boolean
}

interface OutrosData extends ComparisonData {
  tipo: string
}

interface ComparisonResultsProps {
  consorcio: ConsorcioData
  financiamento: FinanciamentoData
  aVista: AVistaData
  outros: OutrosData
  tipoSimulacao: "consorcio" | "financiamento"
}

export function ComparisonResults({ consorcio, financiamento, aVista, outros, tipoSimulacao }: ComparisonResultsProps) {
  const valorBase = consorcio.valorBem

  const parcelaConsorcioComparativo =
    typeof consorcio.parcelaAntesContemplacao === "number" && Number.isFinite(consorcio.parcelaAntesContemplacao)
      ? consorcio.parcelaAntesContemplacao
      : consorcio.parcelaMensal

  const calcularPercentual = (valor: number) => {
    if (!valorBase || !Number.isFinite(valorBase) || valorBase <= 0) return "0.0"
    if (!valor || !Number.isFinite(valor)) return "0.0"
    return ((valor / valorBase) * 100).toFixed(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise Comparativa Detalhada</CardTitle>
        <CardDescription>Entenda as diferenças entre cada modalidade de aquisição</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
          {tipoSimulacao === "consorcio" && (
            <>
              {/* Consórcio vs Financiamento */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Consórcio vs Financiamento</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-base">Consórcio</h4>
                      <Badge className="bg-green-500 text-white">Mais Econômico</Badge>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Custo Total</span>
                          <span className="font-medium">{formatCurrency(consorcio.custoTotal)}</span>
                        </div>
                        <Progress
                          value={Number.parseFloat(calcularPercentual(consorcio.custoTotal))}
                          className="h-2 [&>div]:bg-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Parcela Mensal</span>
                          <span className="font-medium">{formatCurrency(parcelaConsorcioComparativo)}</span>
                        </div>
                        <Progress
                          value={Number.parseFloat(calcularPercentual(parcelaConsorcioComparativo))}
                          className="h-2 [&>div]:bg-blue-500"
                        />
                      </div>

                      <div className="pt-2 space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Sem juros sobre o valor do bem</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Parcelas fixas e previsíveis</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Chance de contemplação antecipada</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Pode dar lances para ser contemplado mais rápido</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-base">Financiamento</h4>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Custo Total</span>
                          <span className="font-medium text-red-600">{formatCurrency(financiamento.custoTotal)}</span>
                        </div>
                        <Progress
                          value={Number.parseFloat(calcularPercentual(financiamento.custoTotal))}
                          className="h-2 [&>div]:bg-red-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Parcela Mensal</span>
                          <span className="font-medium text-red-600">{formatCurrency(financiamento.parcelaMensal)}</span>
                        </div>
                        <Progress
                          value={Number.parseFloat(calcularPercentual(financiamento.parcelaMensal))}
                          className="h-2 [&>div]:bg-red-500"
                        />
                      </div>

                      <div className="pt-2 space-y-2">
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Recebe o bem imediatamente</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                          <span className="text-sm font-semibold text-red-600">
                            Juros de {formatCurrency(financiamento.jurosTotal)}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Entrada de {formatCurrency(financiamento.valorEntrada)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Análise de crédito rigorosa</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="bg-green-50 border-green-200 mt-4">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <TrendingDown className="w-6 h-6 text-green-600 shrink-0 mt-1" />
                      <div>
                        <h4 className="font-bold text-green-900 mb-2 text-lg">Diferença de custo entre Consórcio e Financiamento</h4>
                        <p className="text-sm text-green-800">
                          Ao longo de todo o prazo, a diferença de custo total entre o consórcio e o financiamento é de{" "}
                          <span className="font-bold text-xl text-green-600">
                            {formatCurrency(financiamento.custoTotal - consorcio.custoTotal)}
                          </span>{" "}
                          a favor do consórcio. Isso representa aproximadamente{" "}
                          <span className="font-bold">
                            {(
                              ((financiamento.custoTotal - consorcio.custoTotal) / financiamento.custoTotal) *
                              100
                            ).toFixed(1)}
                            %
                          </span>{" "}
                          de diferença no custo total do período.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* À Vista */}
          <div>
            <h3 className="text-lg font-semibold mb-4">E se eu juntar o dinheiro?</h3>

              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Compra À Vista (Poupando)
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor mensal necessário:</span>
                          <span className="font-semibold">{formatCurrency(aVista.parcelaMensal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Custo total real:</span>
                          <span className="font-semibold">{formatCurrency(aVista.custoTotal)}</span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Você SÓ tem o bem no final do prazo</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Requer disciplina extrema para poupar</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Sem proteção contra inflação do bem</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <span className="text-sm">Perde oportunidades de uso imediato</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-amber-300">
                      <h5 className="font-semibold mb-3 text-amber-900">Por que o Consórcio é melhor?</h5>
                      <div className="space-y-2 text-sm text-amber-900">
                        <p>
                          <Check className="w-4 h-4 inline text-green-600 mr-1" />
                          <strong>Parcela menor:</strong> {formatCurrency(parcelaConsorcioComparativo)} vs{" "}
                          {formatCurrency(aVista.parcelaMensal)}
                        </p>
                        <p>
                          <Check className="w-4 h-4 inline text-green-600 mr-1" />
                          <strong>Contemplação antecipada:</strong> Pode ter o bem antes do fim
                        </p>
                        <p>
                          <Check className="w-4 h-4 inline text-green-600 mr-1" />
                          <strong>Organização automática:</strong> Não depende só da sua disciplina
                        </p>
                        <p>
                          <Check className="w-4 h-4 inline text-green-600 mr-1" />
                          <strong>Custo previsível:</strong> Valor fixo mesmo com inflação
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-amber-100 rounded-lg">
                    <p className="text-sm text-amber-900 font-medium">
                      💡 <strong>Conclusão:</strong> Mesmo que à vista pareça mais barato, você precisa de muita
                      disciplina e espera até o final. O consórcio oferece parcelas menores, chance de contemplação
                      antecipada e organização automática com um custo total competitivo!
                    </p>
                  </div>
                </CardContent>
              </Card>

          </div>

        {/* Recomendação Final */}
        <Card className="bg-primary text-primary-foreground mt-6">
          <CardContent className="pt-6">
            <h4 className="font-bold mb-3 text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Recomendação para Você
            </h4>
            <p className="text-sm text-primary-foreground/95 leading-relaxed">
              {consorcio.custoTotal <= financiamento.custoTotal
                ? "Neste cenário, o consórcio apresenta um custo total menor em relação ao financiamento, com parcelas mais baixas e possibilidade de contemplação antecipada por sorteio ou lance. É uma alternativa que reduz o impacto financeiro de longo prazo em comparação com os juros do financiamento."
                : "Neste cenário, o financiamento apresenta um custo total menor em relação ao consórcio. Ainda assim, avalie bem as condições (taxa de juros, entrada e prazo), pois o financiamento costuma ter maior impacto financeiro quando os juros são altos."}
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}
