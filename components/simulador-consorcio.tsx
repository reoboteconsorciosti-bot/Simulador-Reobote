"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calculator, TrendingUp, CreditCard, Wallet, BarChart3, Target } from "lucide-react"
import { ComparisonResults } from "@/components/comparison-results"
import { formatCurrency } from "@/lib/formatters"

export function SimuladorConsorcio() {
  const [tipoSimulacao, setTipoSimulacao] = useState<"consorcio" | "financiamento">("consorcio")

  const [valorBem, setValorBem] = useState<string>("50000")
  const [prazoMeses, setPrazoMeses] = useState<string>("60")
  const [taxaAdministracao, setTaxaAdministracao] = useState<string>("15")
  const [fundoReserva, setFundoReserva] = useState<string>("3")
  const [lanceConsorcio, setLanceConsorcio] = useState<string>("0")
  const [tipoLance, setTipoLance] = useState<"livre" | "embutido" | "ambos">("livre")
  const [lanceEmbutidoPercent, setLanceEmbutidoPercent] = useState<string>("50")
  const [taxaFinanciamento, setTaxaFinanciamento] = useState<string>("2.5")
  const [entrada, setEntrada] = useState<string>("30")
  const [rendimentoPoupanca, setRendimentoPoupanca] = useState<string>("0.6")
  const [showResults, setShowResults] = useState(false)

  const calcularConsorcio = () => {
    const valor = Number.parseFloat(valorBem)
    const prazo = Number.parseInt(prazoMeses)
    const taxaAdmin = Number.parseFloat(taxaAdministracao) / 100
    const fundoRes = Number.parseFloat(fundoReserva) / 100
    const percLance = Number.parseFloat(lanceConsorcio) / 100
    const valorLance = valor * percLance

    const taxaAdminTotal = valor * taxaAdmin
    const fundoReservaTotal = valor * fundoRes

    let custoTotal = valor + taxaAdminTotal + fundoReservaTotal
    let parcelaMensal = custoTotal / prazo
    let valorLanceLivre = 0
    let valorLanceEmbutido = 0

    if (valorLance > 0) {
      if (tipoLance === "livre") {
        valorLanceLivre = valorLance
      } else if (tipoLance === "embutido") {
        valorLanceEmbutido = valorLance
        custoTotal += valorLance
        parcelaMensal = custoTotal / prazo
      } else if (tipoLance === "ambos") {
        const percEmbutido = Number.parseFloat(lanceEmbutidoPercent) / 100
        valorLanceEmbutido = valorLance * percEmbutido
        valorLanceLivre = valorLance * (1 - percEmbutido)
        custoTotal += valorLanceEmbutido
        parcelaMensal = custoTotal / prazo
      }
    }

    return {
      parcelaMensal,
      custoTotal,
      taxaAdminTotal,
      fundoReservaTotal,
      valorBem: valor,
      valorLance,
      valorLanceLivre,
      valorLanceEmbutido,
      tipoLance,
    }
  }

  const calcularFinanciamento = () => {
    const valor = Number.parseFloat(valorBem)
    const prazo = Number.parseInt(prazoMeses)
    const taxaMensal = Number.parseFloat(taxaFinanciamento) / 100
    const percEntrada = Number.parseFloat(entrada) / 100

    const valorEntrada = valor * percEntrada
    const valorFinanciado = valor - valorEntrada

    const parcelaMensal =
      (valorFinanciado * (taxaMensal * Math.pow(1 + taxaMensal, prazo))) / (Math.pow(1 + taxaMensal, prazo) - 1)
    const totalPago = parcelaMensal * prazo + valorEntrada
    const jurosTotal = totalPago - valor

    return {
      parcelaMensal,
      custoTotal: totalPago,
      valorEntrada,
      jurosTotal,
      valorBem: valor,
    }
  }

  const calcularAVista = () => {
    const valor = Number.parseFloat(valorBem)
    const prazo = Number.parseInt(prazoMeses)
    const rendMensal = Number.parseFloat(rendimentoPoupanca) / 100

    const fatorCustoOportunidade = 1.15
    const parcelaMensal = (valor * fatorCustoOportunidade) / prazo
    const valorFinalNecessario = valor * fatorCustoOportunidade

    return {
      parcelaMensal,
      custoTotal: valorFinalNecessario,
      economizado: 0,
      valorBem: valor,
      disciplinaRequerida: true,
    }
  }

  const calcularOutros = () => {
    const valor = Number.parseFloat(valorBem)
    const prazo = Number.parseInt(prazoMeses)

    const taxaAluguel = 0.01
    const parcelaMensal = valor * taxaAluguel
    const custoTotal = parcelaMensal * prazo

    return {
      parcelaMensal,
      custoTotal,
      valorBem: valor,
      tipo: "Aluguel com opção de compra",
    }
  }

  const handleSimular = () => {
    setShowResults(true)
  }

  const consorcio = calcularConsorcio()
  const financiamento = calcularFinanciamento()
  const aVista = calcularAVista()
  const outros = calcularOutros()

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Calculator className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-balance">Simulador de Consórcios</h1>
        </div>
        <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
          Compare diferentes modalidades de aquisição e escolha a melhor opção para realizar seu sonho
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Configurações
            </CardTitle>
            <CardDescription>Personalize os parâmetros da simulação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs
              value={tipoSimulacao}
              onValueChange={(v) => setTipoSimulacao(v as "consorcio" | "financiamento")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="consorcio">Consórcio</TabsTrigger>
                <TabsTrigger value="financiamento">Financiamento</TabsTrigger>
              </TabsList>

              <TabsContent value="consorcio" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="valorBem">Valor do Bem (R$)</Label>
                  <Input
                    id="valorBem"
                    type="number"
                    value={valorBem}
                    onChange={(e) => setValorBem(e.target.value)}
                    placeholder="50000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prazoMeses">Prazo (meses)</Label>
                  <Input
                    id="prazoMeses"
                    type="number"
                    value={prazoMeses}
                    onChange={(e) => setPrazoMeses(e.target.value)}
                    placeholder="60"
                  />
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Target className="w-4 h-4" />
                      Lance para Contemplação
                    </CardTitle>
                    <CardDescription className="text-xs">Aumente suas chances de ser contemplado</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="lanceConsorcio" className="text-sm font-medium">
                        Valor do Lance (%)
                      </Label>
                      <Input
                        id="lanceConsorcio"
                        type="number"
                        step="1"
                        value={lanceConsorcio}
                        onChange={(e) => setLanceConsorcio(e.target.value)}
                        placeholder="0"
                        className="border-primary/30 focus-visible:ring-primary"
                      />
                      {Number.parseFloat(lanceConsorcio) > 0 && (
                        <p className="text-xs text-primary font-medium">
                          Valor:{" "}
                          {formatCurrency(Number.parseFloat(valorBem) * (Number.parseFloat(lanceConsorcio) / 100))}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-primary/10">
                      <Label className="text-sm font-medium">Modalidade de Pagamento</Label>
                      <RadioGroup
                        value={tipoLance}
                        onValueChange={(v) => setTipoLance(v as "livre" | "embutido" | "ambos")}
                        className="space-y-3"
                      >
                        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <RadioGroupItem value="livre" id="lance-livre" className="mt-0.5" />
                          <Label htmlFor="lance-livre" className="font-normal cursor-pointer flex-1">
                            <span className="font-medium text-sm block mb-0.5">Lance Livre</span>
                            <span className="text-xs text-muted-foreground">
                              Valor pago separadamente, não afeta a parcela mensal
                            </span>
                          </Label>
                        </div>

                        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <RadioGroupItem value="embutido" id="lance-embutido" className="mt-0.5" />
                          <Label htmlFor="lance-embutido" className="font-normal cursor-pointer flex-1">
                            <span className="font-medium text-sm block mb-0.5">Lance Embutido</span>
                            <span className="text-xs text-muted-foreground">
                              Valor dividido nas parcelas mensais do consórcio
                            </span>
                          </Label>
                        </div>

                        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <RadioGroupItem value="ambos" id="lance-ambos" className="mt-0.5" />
                          <Label htmlFor="lance-ambos" className="font-normal cursor-pointer flex-1">
                            <span className="font-medium text-sm block mb-0.5">Ambos (Livre + Embutido)</span>
                            <span className="text-xs text-muted-foreground">
                              Combine as duas modalidades para maior flexibilidade
                            </span>
                          </Label>
                        </div>
                      </RadioGroup>

                      {tipoLance === "ambos" && (
                        <div className="space-y-2 pt-2 border-t border-primary/10">
                          <Label htmlFor="lanceEmbutidoPercent" className="text-sm font-medium">
                            % do Lance que será Embutido
                          </Label>
                          <Input
                            id="lanceEmbutidoPercent"
                            type="number"
                            step="5"
                            min="0"
                            max="100"
                            value={lanceEmbutidoPercent}
                            onChange={(e) => setLanceEmbutidoPercent(e.target.value)}
                            placeholder="50"
                            className="border-primary/30"
                          />
                          <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-2 rounded">
                            <p>
                              <span className="font-medium">Embutido:</span>{" "}
                              {formatCurrency(
                                Number.parseFloat(valorBem) *
                                  (Number.parseFloat(lanceConsorcio) / 100) *
                                  (Number.parseFloat(lanceEmbutidoPercent) / 100),
                              )}
                            </p>
                            <p>
                              <span className="font-medium">Livre:</span>{" "}
                              {formatCurrency(
                                Number.parseFloat(valorBem) *
                                  (Number.parseFloat(lanceConsorcio) / 100) *
                                  (1 - Number.parseFloat(lanceEmbutidoPercent) / 100),
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label htmlFor="taxaAdmin">Taxa de Administração (%)</Label>
                  <Input
                    id="taxaAdmin"
                    type="number"
                    step="0.1"
                    value={taxaAdministracao}
                    onChange={(e) => setTaxaAdministracao(e.target.value)}
                    placeholder="15"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fundoReserva">Fundo de Reserva (%)</Label>
                  <Input
                    id="fundoReserva"
                    type="number"
                    step="0.1"
                    value={fundoReserva}
                    onChange={(e) => setFundoReserva(e.target.value)}
                    placeholder="3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rendimentoPoupanca">Rendimento Poupança (% a.m.)</Label>
                  <Input
                    id="rendimentoPoupanca"
                    type="number"
                    step="0.1"
                    value={rendimentoPoupanca}
                    onChange={(e) => setRendimentoPoupanca(e.target.value)}
                    placeholder="0.6"
                  />
                </div>
              </TabsContent>

              <TabsContent value="financiamento" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="valorBemFin">Valor do Bem (R$)</Label>
                  <Input
                    id="valorBemFin"
                    type="number"
                    value={valorBem}
                    onChange={(e) => setValorBem(e.target.value)}
                    placeholder="50000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prazoMesesFin">Prazo (meses)</Label>
                  <Input
                    id="prazoMesesFin"
                    type="number"
                    value={prazoMeses}
                    onChange={(e) => setPrazoMeses(e.target.value)}
                    placeholder="60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxaFinanciamento">Taxa de Juros (% a.m.)</Label>
                  <Input
                    id="taxaFinanciamento"
                    type="number"
                    step="0.1"
                    value={taxaFinanciamento}
                    onChange={(e) => setTaxaFinanciamento(e.target.value)}
                    placeholder="2.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entrada">Entrada (%)</Label>
                  <Input
                    id="entrada"
                    type="number"
                    step="1"
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    placeholder="30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rendimentoPoupancaFin">Rendimento Poupança (% a.m.)</Label>
                  <Input
                    id="rendimentoPoupancaFin"
                    type="number"
                    step="0.1"
                    value={rendimentoPoupanca}
                    onChange={(e) => setRendimentoPoupanca(e.target.value)}
                    placeholder="0.6"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleSimular} className="w-full" size="lg">
              <Calculator className="w-4 h-4 mr-2" />
              Calcular Simulação
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {!showResults ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Configure e Simule</h3>
                <p className="text-muted-foreground text-center text-balance">
                  Preencha os campos ao lado e clique em "Calcular Simulação" para ver os resultados
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {tipoSimulacao === "consorcio" ? (
                  <>
                    <Card className="bg-primary text-primary-foreground md:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <CreditCard className="w-5 h-5" />
                          Consórcio - Sua Melhor Escolha
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold mb-2">{formatCurrency(consorcio.parcelaMensal)}/mês</div>
                        <p className="text-sm text-primary-foreground/80">
                          Total: {formatCurrency(consorcio.custoTotal)}
                        </p>
                        {consorcio.valorLance > 0 && (
                          <div className="mt-2 pt-2 border-t border-primary-foreground/20 space-y-1">
                            {consorcio.tipoLance === "livre" && (
                              <p className="text-sm text-primary-foreground/90">
                                Lance Livre: {formatCurrency(consorcio.valorLanceLivre)}
                              </p>
                            )}
                            {consorcio.tipoLance === "embutido" && (
                              <p className="text-sm text-primary-foreground/90">
                                Lance Embutido: {formatCurrency(consorcio.valorLanceEmbutido)}
                              </p>
                            )}
                            {consorcio.tipoLance === "ambos" && (
                              <>
                                <p className="text-sm text-primary-foreground/90">
                                  Lance Livre: {formatCurrency(consorcio.valorLanceLivre)}
                                </p>
                                <p className="text-sm text-primary-foreground/90">
                                  Lance Embutido: {formatCurrency(consorcio.valorLanceEmbutido)}
                                </p>
                              </>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-muted">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Wallet className="w-4 h-4" />À Vista (Poupança)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-1">{formatCurrency(aVista.parcelaMensal)}/mês</div>
                        <p className="text-xs text-muted-foreground">Total: {formatCurrency(aVista.custoTotal)}</p>
                        <p className="text-xs text-amber-600 mt-1">⚠️ Requer muita disciplina</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Outras Opções
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-1">{formatCurrency(outros.parcelaMensal)}/mês</div>
                        <p className="text-xs text-muted-foreground">Total: {formatCurrency(outros.custoTotal)}</p>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <>
                    <Card className="bg-secondary text-secondary-foreground md:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <CreditCard className="w-5 h-5" />
                          Financiamento - Bem Imediato
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold mb-2">{formatCurrency(financiamento.parcelaMensal)}/mês</div>
                        <p className="text-sm text-secondary-foreground/80">
                          Total: {formatCurrency(financiamento.custoTotal)}
                        </p>
                        <p className="text-sm text-red-600 mt-1">⚠️ Juros: {formatCurrency(financiamento.jurosTotal)}</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Wallet className="w-4 h-4" />À Vista (Poupança)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-1">{formatCurrency(aVista.parcelaMensal)}/mês</div>
                        <p className="text-xs text-muted-foreground">Total: {formatCurrency(aVista.custoTotal)}</p>
                        <p className="text-xs text-amber-600 mt-1">⚠️ Espera até o final</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Outras Opções
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-1">{formatCurrency(outros.parcelaMensal)}/mês</div>
                        <p className="text-xs text-muted-foreground">Total: {formatCurrency(outros.custoTotal)}</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              <ComparisonResults
                consorcio={consorcio}
                financiamento={financiamento}
                aVista={aVista}
                outros={outros}
                tipoSimulacao={tipoSimulacao}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
