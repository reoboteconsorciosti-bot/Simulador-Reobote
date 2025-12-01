"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Check, X, TrendingDown, AlertCircle, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/formatters"

interface ComparisonData {
  parcelaMensal: number
  custoTotal: number
  valorBem: number
}

interface ConsorcioData extends ComparisonData {
  taxaAdminTotal: number
  fundoReservaTotal: number
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

  const calcularPercentual = (valor: number) => {
    return ((valor / valorBase) * 100).toFixed(1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise Comparativa Detalhada</CardTitle>
        <CardDescription>Entenda as diferenças entre cada modalidade de aquisição</CardDescription>
      </CardHeader>
      <CardContent>
        {tipoSimulacao === "consorcio" ? (
          <div className="space-y-6">
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
                      <Progress value={Number.parseFloat(calcularPercentual(consorcio.custoTotal))} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Parcela Mensal</span>
                        <span className="font-medium">{formatCurrency(consorcio.parcelaMensal)}</span>
                      </div>
                      <Progress
                        value={Number.parseFloat(calcularPercentual(consorcio.parcelaMensal))}
                        className="h-2"
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
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      Juros Elevados
                    </Badge>
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
                      <h4 className="font-bold text-green-900 mb-2 text-lg">Economia Significativa com Consórcio!</h4>
                      <p className="text-sm text-green-800">
                        Escolhendo o consórcio, você economiza{" "}
                        <span className="font-bold text-xl text-green-600">
                          {formatCurrency(financiamento.custoTotal - consorcio.custoTotal)}
                        </span>{" "}
                        em relação ao financiamento! Isso representa{" "}
                        <span className="font-bold">
                          {(
                            ((financiamento.custoTotal - consorcio.custoTotal) / financiamento.custoTotal) *
                            100
                          ).toFixed(1)}
                          %
                        </span>{" "}
                        de economia no custo total.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                          <strong>Parcela menor:</strong> {formatCurrency(consorcio.parcelaMensal)} vs{" "}
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
          </div>
        ) : (
          <div className="space-y-6">
            {/* Financiamento vs Consórcio */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Financiamento vs Consórcio</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base">Financiamento</h4>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Bem Imediato
                    </Badge>
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
                        <span className="text-sm">Recebe o bem na hora</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-sm">Aprovação rápida</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                        <span className="text-sm font-semibold text-red-600">
                          Juros altos: {formatCurrency(financiamento.jurosTotal)}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                        <span className="text-sm">Requer entrada significativa</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base">Consórcio</h4>
                    <Badge className="bg-green-500 text-white">
                      Economia de{" "}
                      {(((financiamento.custoTotal - consorcio.custoTotal) / financiamento.custoTotal) * 100).toFixed(
                        0,
                      )}
                      %
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Custo Total</span>
                        <span className="font-medium text-green-600">{formatCurrency(consorcio.custoTotal)}</span>
                      </div>
                      <Progress
                        value={Number.parseFloat(calcularPercentual(consorcio.custoTotal))}
                        className="h-2 [&>div]:bg-green-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Parcela Mensal</span>
                        <span className="font-medium text-green-600">{formatCurrency(consorcio.parcelaMensal)}</span>
                      </div>
                      <Progress
                        value={Number.parseFloat(calcularPercentual(consorcio.parcelaMensal))}
                        className="h-2 [&>div]:bg-green-500"
                      />
                    </div>

                    <div className="pt-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-sm font-semibold">Sem juros sobre o bem</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-sm">Parcelas menores e fixas</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-sm">Contemplação por sorteio ou lance</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <span className="text-sm">Flexibilidade para dar lances</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-blue-50 border-blue-200 mt-4">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <TrendingDown className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-blue-900 mb-2 text-lg">Vantagem Financeira do Consórcio</h4>
                      <p className="text-sm text-blue-800">
                        Com o consórcio você economiza{" "}
                        <span className="font-bold text-xl text-blue-600">
                          {formatCurrency(financiamento.custoTotal - consorcio.custoTotal)}
                        </span>{" "}
                        comparado ao financiamento. Isso é dinheiro que fica no seu bolso! Além disso, as parcelas são{" "}
                        <span className="font-bold">
                          {formatCurrency(financiamento.parcelaMensal - consorcio.parcelaMensal)}
                        </span>{" "}
                        mais baratas por mês.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* À Vista */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Comparação com Pagamento à Vista</h3>

              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Valor necessário para poupar mensalmente:</span>
                      <span className="font-bold text-lg">{formatCurrency(aVista.parcelaMensal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Custo total considerando inflação:</span>
                      <span className="font-bold text-lg">{formatCurrency(aVista.custoTotal)}</span>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        <AlertCircle className="w-4 h-4 inline mr-1 text-amber-600" />
                        Lembrando que na compra à vista você só terá o bem ao final do período, após juntar todo o
                        dinheiro necessário. Enquanto isso, o valor do bem pode aumentar com a inflação.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Recomendação Final */}
        <Card className="bg-primary text-primary-foreground mt-6">
          <CardContent className="pt-6">
            <h4 className="font-bold mb-3 text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Recomendação para Você
            </h4>
            <p className="text-sm text-primary-foreground/95 leading-relaxed">
              {tipoSimulacao === "consorcio"
                ? "O consórcio é a escolha inteligente! Você economiza significativamente em relação ao financiamento, tem parcelas menores que a poupança para à vista, e ainda pode ser contemplado antes do prazo final através de sorteios ou lances. É o equilíbrio perfeito entre economia e praticidade."
                : "Apesar do financiamento oferecer o bem imediatamente, você pagará muito mais caro devido aos juros elevados. O consórcio representa uma economia substancial e oferece flexibilidade através de contemplações antecipadas, sendo a opção mais vantajosa financeiramente."}
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}
