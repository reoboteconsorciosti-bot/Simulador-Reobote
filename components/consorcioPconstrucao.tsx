"use client"

import { useState } from "react"
import { Calculator, Calendar, Coins, Percent, Hammer, Target, Dices, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { formatCurrency, parseCurrencyInput } from "@/lib/formatters"

interface ConsorcioPConstrucaoProps {
    onSimular: (dados: any) => void
}

export function ConsorcioPConstrucao({ onSimular }: ConsorcioPConstrucaoProps) {
    const [valorCredito, setValorCredito] = useState("")
    const [prazo, setPrazo] = useState("")
    const [taxaAdm, setTaxaAdm] = useState("")
    const [planoReducao, setPlanoReducao] = useState("1")
    const [seguroPrestamista, setSeguroPrestamista] = useState("3")
    const [taxaINCC, setTaxaINCC] = useState("")
    const [tipoINCC, setTipoINCC] = useState<"anual" | "semestral">("anual")
    const [tipoContemplacao, setTipoContemplacao] = useState<"meses" | "anos">("meses")
    const [dataContemplacao, setDataContemplacao] = useState("")
    const [lanceEmbutido, setLanceEmbutido] = useState("")
    const [lancePago, setLancePago] = useState("")
    const [lanceOfertado, setLanceOfertado] = useState("")
    const [abatimentoLance, setAbatimentoLance] = useState("1")
    const [mesLance, setMesLance] = useState("")
    const [tipoLanceSelect, setTipoLanceSelect] = useState("livre")

    const handleCurrencyChange = (value: string, setter: (val: string) => void) => {
        const numbers = value.replace(/\D/g, "")
        if (!numbers || numbers === "0") {
            setter("")
            return
        }
        const formatted = formatCurrency(Number(numbers) / 100)
        setter(formatted)
    }

    const getPlanoLightFactor = (v: string): number => {
        switch (v) {
            case "2": return 0.9
            case "3": return 0.8
            case "4": return 0.7
            case "5": return 0.6
            case "6": return 0.5
            case "1":
            default: return 1.0
        }
    }

    const calculateInitialInstallment = (credito: number, taxaAdm: number, prazo: number, planoRed: string) => {
        const custoTotalInicial = credito * (1 + taxaAdm / 100)
        const planoLightFactor = getPlanoLightFactor(planoRed)
        return (custoTotalInicial / prazo) * planoLightFactor
    }

    const calculateUpdatedCredit = (credito: number, taxaINCC: number, tipoINCC: string, valorContemplacao: number, tipoContemplativo: string) => {
        const mesesContemplacao = tipoContemplativo === "anos" ? valorContemplacao * 12 : valorContemplacao
        const taxaMensal = tipoINCC === "semestral" ? (taxaINCC / 100) / 6 : (taxaINCC / 100) / 12
        return credito * Math.pow(1 + taxaMensal, mesesContemplacao)
    }

    const calculateBidValues = (tipo: string, credito: number, embutidoPct: number, pagoPct: number) => {
        if (tipo === "sorteio") return { total: 0, embutido: 0, pago: 0, totalPct: 0 }
        if (tipo === "fixo_30") {
            const totalPct = 30
            // No simulador padrão, o embutido é 30% do crédito.
            return {
                total: credito * 0.3,
                embutido: credito * 0.3,
                pago: 0,
                totalPct: 30
            }
        }
        // Livre
        const totalPct = embutidoPct + pagoPct
        return {
            total: credito * (totalPct / 100),
            embutido: credito * (embutidoPct / 100),
            pago: credito * (pagoPct / 100),
            totalPct
        }
    }

    const calculateSimulationResults = (dados: any) => {
        const { valorCredito, taxaAdm, prazo, parcelaIntegral, valorLanceTotal, abatimentoLance } = dados

        const custoTotalOriginal = valorCredito * (1 + taxaAdm / 100)
        const saldoDevedor = custoTotalOriginal - valorLanceTotal

        let novaParcela = parcelaIntegral
        let novoPrazo = prazo

        // Lógica de cálculo interno (apenas para exibição local ou pré-cálculo)
        // O componente pai (SimuladorConsorcio) tem a autoridade final, 
        // mas enviamos isso calculado caso ele decida usar.
        const parcelasPagasPeloLance = Math.floor(valorLanceTotal / parcelaIntegral)
        const qtdParcelasPagas = (dados.mesLance || 0) + parcelasPagasPeloLance
        const parcelasAPagarQtd = Math.max(0, prazo - qtdParcelasPagas)

        if (abatimentoLance === "1") { // Reduzir Prazo
            novoPrazo = Math.ceil(saldoDevedor / parcelaIntegral)
            novaParcela = parcelaIntegral
        } else if (abatimentoLance === "3") { // Não (Abater Parcelas)
            novoPrazo = parcelasAPagarQtd
            novaParcela = parcelaIntegral
            if (novoPrazo > 0) novaParcela = saldoDevedor / novoPrazo
        } else if (abatimentoLance === "2") { // LUDC
            novaParcela = saldoDevedor / prazo
            novoPrazo = prazo
        }

        return {
            ...dados,
            saldoDevedor,
            novaParcela,
            novoPrazo
        }
    }

    const handleSubmit = () => {
        const creditoBase = parseCurrencyInput(valorCredito)
        const prazoNum = Number(prazo)
        const taxaAdmNum = Number(taxaAdm)
        const inccNum = Number(taxaINCC)
        const contemplacaoValor = Number(dataContemplacao)
        const lanceEmbPct = Number(lanceEmbutido)
        const lancePagoPct = Number(lancePago)

        const parcelaIntegral = calculateInitialInstallment(creditoBase, taxaAdmNum, prazoNum, planoReducao)
        const creditoAtualizado = calculateUpdatedCredit(creditoBase, inccNum, tipoINCC, contemplacaoValor, tipoContemplacao)
        const lances = calculateBidValues(tipoLanceSelect, creditoBase, lanceEmbPct, lancePagoPct)

        const dadosIniciais = {
            valorCredito: creditoBase,
            prazo: prazoNum,
            taxaAdm: taxaAdmNum,
            planoReducao,
            seguroPrestamista: Number(seguroPrestamista),
            taxaINCC: inccNum,
            tipoINCC,
            contemplacao: {
                tipo: tipoContemplacao,
                valor: contemplacaoValor
            },
            // CORREÇÃO: Passando PORCENTAGENS para o pai, não valores monetários
            lanceEmbutido: lanceEmbPct,
            lancePago: lancePagoPct,

            // Passamos a porcentagem total calculada (somatória ou fixa)
            lanceOfertado: lances.totalPct,

            // Dados calculados para uso opcional
            valorLanceTotal: lances.total,
            parcelaIntegral,
            creditoAtualizado,
            abatimentoLance,
            mesLance: Number(mesLance),
            tipoLance: tipoLanceSelect
        }

        const resultadosFinais = calculateSimulationResults(dadosIniciais)
        onSimular(resultadosFinais)
    }

    return (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                    <Hammer className="w-5 h-5" />
                    Simulação de Construção
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Crédito e Prazo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="valorCredito">Valor do Crédito</Label>
                        <div className="relative">
                            <Coins className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="valorCredito"
                                value={valorCredito}
                                onChange={(e) => handleCurrencyChange(e.target.value, setValorCredito)}
                                className="pl-9"
                                placeholder="R$ 0,00"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="prazo">Prazo (meses)</Label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="prazo"
                                type="number"
                                value={prazo}
                                onChange={(e) => setPrazo(e.target.value)}
                                className="pl-9"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* Taxas e Seguro */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="taxaAdm">Taxa Adm. (%)</Label>
                        <div className="relative">
                            <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="taxaAdm"
                                type="number"
                                value={taxaAdm}
                                onChange={(e) => setTaxaAdm(e.target.value)}
                                className="pl-9"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="planoLight">Plano de Redução</Label>
                        <select
                            id="planoLight"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                            value={planoReducao}
                            onChange={(e) => setPlanoReducao(e.target.value)}
                        >
                            <option value="1">Integral (Sem redução)</option>
                            <option value="2">Plano Flex 10%</option>
                            <option value="3">Plano Flex 20%</option>
                            <option value="4">Plano Flex 30%</option>
                            <option value="5">Plano Flex 40%</option>
                            <option value="6">Plano Flex 50%</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="seguroPrestamista">Seguro Prestamista</Label>
                        <select
                            id="seguroPrestamista"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                            value={seguroPrestamista}
                            onChange={(e) => setSeguroPrestamista(e.target.value)}
                        >
                            <option value="1">Automóvel</option>
                            <option value="2">Imóvel</option>
                            <option value="3">Sem seguro</option>
                        </select>
                    </div>
                </div>

                {/* INCC e Contemplação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="incc" className="text-sm font-medium">INCC (%)</Label>
                        <Tabs
                            value={tipoINCC}
                            onValueChange={(v: any) => setTipoINCC(v)}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2 h-8 p-1 bg-muted/50">
                                <TabsTrigger
                                    value="anual"
                                    className="text-[10px] data-[state=active]:bg-white"
                                >
                                    Ano
                                </TabsTrigger>
                                <TabsTrigger
                                    value="semestral"
                                    className="text-[10px] data-[state=active]:bg-white"
                                >
                                    Semestre
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Input
                            id="incc"
                            type="number"
                            value={taxaINCC}
                            onChange={(e) => setTaxaINCC(e.target.value)}
                            placeholder="0.00"
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Contemplação</Label>
                        <Tabs
                            value={tipoContemplacao}
                            onValueChange={(v: any) => setTipoContemplacao(v)}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2 h-8 p-1 bg-muted/50">
                                <TabsTrigger
                                    value="meses"
                                    className="text-[10px] data-[state=active]:bg-white"
                                >
                                    Mês
                                </TabsTrigger>
                                <TabsTrigger
                                    value="anos"
                                    className="text-[10px] data-[state=active]:bg-white"
                                >
                                    Ano
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                value={dataContemplacao}
                                onChange={(e) => setDataContemplacao(e.target.value)}
                                placeholder="Tempo"
                                className="pl-9 h-9"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tipoLance" className="text-sm font-medium text-muted-foreground">Tipo de Lance</Label>
                        <select
                            id="tipoLance"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                            value={tipoLanceSelect}
                            onChange={(e) => setTipoLanceSelect(e.target.value)}
                        >
                            <option value="livre">Lance Livre</option>
                            <option value="fixo_30">Lance Fixo 30%</option>
                            <option value="sorteio">Por Sorteio</option>
                        </select>
                    </div>

                    {tipoLanceSelect === "livre" ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-2">
                                <Label htmlFor="lanceEmbutido">Lance Embutido (%)</Label>
                                <Input
                                    id="lanceEmbutido"
                                    type="number"
                                    value={lanceEmbutido}
                                    onChange={(e) => setLanceEmbutido(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lancePago">Lance Pago (%)</Label>
                                <Input
                                    id="lancePago"
                                    type="number"
                                    value={lancePago}
                                    onChange={(e) => setLancePago(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lanceOfertado">Lance Ofertado (%)</Label>
                                <Input
                                    id="lanceOfertado"
                                    type="number"
                                    value={lanceOfertado}
                                    onChange={(e) => setLanceOfertado(e.target.value)}
                                    placeholder="Total"
                                    readOnly
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {Number(lanceEmbutido || 0) + Number(lancePago || 0)}% Total
                                </p>
                            </div>
                        </div>
                    ) : tipoLanceSelect === "fixo_30" ? (
                        <div className="bg-sky-50 border border-sky-200 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-2 animate-in zoom-in-95 duration-300">
                            <div className="bg-sky-500 p-2 rounded-full">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <h5 className="font-bold text-sky-900">Lance Fixo de 30%</h5>
                            <p className="text-xs text-sky-700 max-w-[280px]">
                                O lance será ofertado utilizando 30% do valor do crédito automaticamente.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-2 animate-in zoom-in-95 duration-300">
                            <div className="bg-amber-500 p-2 rounded-full animate-pulse">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <h5 className="font-bold text-amber-900">Participação por Sorteio</h5>
                            <p className="text-xs text-amber-700 max-w-[280px]">
                                Nesta modalidade você concorrerá mensalmente através das extrações da Loteria Federal.
                            </p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="diluirLance">Forma de Abatimento do Lance</Label>
                        <select
                            id="diluirLance"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-9"
                            value={abatimentoLance}
                            onChange={(e) => setAbatimentoLance(e.target.value)}
                        >
                            <option value="1">Sim (Abater Prazo)</option>
                            <option value="2">LUDC</option>
                            <option value="3">Não (Abater Parcelas)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mesLance">Mês do Lance (Assembleia)</Label>
                        <Input
                            id="mesLance"
                            type="number"
                            value={mesLance}
                            onChange={(e) => setMesLance(e.target.value)}
                            placeholder="Ex: 1"
                        />
                    </div>
                </div>

                <Button
                    className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white mt-6"
                    onClick={handleSubmit}
                >
                    SIMULAR CONSTRUÇÃO
                </Button>
            </CardContent>
        </Card>
    )
}
