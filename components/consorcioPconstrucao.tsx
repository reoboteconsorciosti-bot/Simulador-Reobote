"use client"

import { useState } from "react"
import { Calculator, Dices, Hammer, SlidersHorizontal, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { parseCurrencyInput } from "@/lib/formatters"
import { calcularConstrucao, calcularCreditoAtualizado, calcularValorizacao, type ConstrucaoInputs, type ConstrucaoOutputs } from "./calcConstrucao"

type ModoContemplacao = "sorteio" | "lance_fixo" | "lance_livre"

interface ConsorcioPConstrucaoProps {
    onSimular: (dados: ConstrucaoOutputs) => void
    onGerarPDF?: () => void
}

export function ConsorcioPConstrucao({ onSimular, onGerarPDF }: ConsorcioPConstrucaoProps) {
    // STATE - Inputs
    const [valorCredito, setValorCredito] = useState("")
    const [prazo, setPrazo] = useState("")
    const [prazoError, setPrazoError] = useState<string>("")
    const [taxaAdm, setTaxaAdm] = useState("") // Taxa Fixa ou Mensal? Assumir valor monetário pela fórmula (Taxa + ...)
    const [taxaINCC, setTaxaINCC] = useState("") // %
    const [tempoContemplacao, setTempoContemplacao] = useState("")
    const [tipoReajuste, setTipoReajuste] = useState<"anual" | "semestral">("anual")

    const [planoLight, setPlanoLight] = useState<string>("1")
    const [seguroPrestamista, setSeguroPrestamista] = useState<string>("3")
    const [diluirLance, setDiluirLance] = useState<string>("3")

    const [modoContemplacao, setModoContemplacao] = useState<ModoContemplacao>("sorteio")
    const [lanceEmbutidoPercent, setLanceEmbutidoPercent] = useState("")
    const [lanceLivrePercent, setLanceLivrePercent] = useState("")
    const [valorizacaoBem, setValorizacaoBem] = useState("")
    const [rendaMensalImovel, setRendaMensalImovel] = useState("")
    const [reinvestimentoMensal, setReinvestimentoMensal] = useState("")

    const creditoNumber = parseCurrencyInput(valorCredito)
    // const lanceLivreValorNumber = parseCurrencyInput(lanceLivreValor) // Não usado mais diretamente como input
    const lanceLivrePercentNumber = Number(lanceLivrePercent.toString().replace(",", ".")) || 0
    const lanceEmbutidoPercentNumber = Number(lanceEmbutidoPercent.toString().replace(",", ".")) || 0
    const inccNumber = Number(taxaINCC.toString().replace(",", ".")) || 0
    const contemplacaoNumber = Number(tempoContemplacao) || 0

    const creditoAtualizadoPreview = (() => {
        try {
            if (creditoNumber <= 0) return 0
            return calcularCreditoAtualizado(creditoNumber, inccNumber, contemplacaoNumber, tipoReajuste).valorFinal
        } catch {
            return 0
        }
    })()

    const baseCreditoLancePreview = creditoAtualizadoPreview > 0 ? creditoAtualizadoPreview : creditoNumber

    // Cálculos Derivados
    const lanceFixoPercentNumber = 30
    const valorLanceLivre = baseCreditoLancePreview * (lanceLivrePercentNumber / 100)
    const valorLanceEmbutido = baseCreditoLancePreview * (lanceEmbutidoPercentNumber / 100)
    const valorLanceFixo = baseCreditoLancePreview * (lanceFixoPercentNumber / 100)

    // Crédito Líquido = Crédito - Embutido (O Livre é pago por fora, não reduz o crédito)
    const creditoLiquido = Math.max(0, baseCreditoLancePreview - valorLanceEmbutido)

    const round0 = (v: number) => Math.round(v)

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

    const L16_CONST = 0.000599
    const L17_CONST = 0.000392

    const calcParcelaComPlanoESeguro = (credito: number, prazoMeses: number, taxaPercent: number): number => {
        if (credito <= 0 || prazoMeses <= 0) return 0

        const taxaDecimal = taxaPercent / 100
        const N13 = 1 + taxaDecimal
        const baseParcela = (credito / prazoMeses) * N13

        const factor = getPlanoLightFactor(Number(planoLight) || 1)

        const tipoSeguro = Number(seguroPrestamista) || 3
        const isAutomovel = tipoSeguro === 1
        const isImovel = tipoSeguro === 2

        const N12 = credito * N13
        const seguroVida = L16_CONST * N12 * (isAutomovel ? 1 : 0)
        const seguroGarantia = L17_CONST * N12 * (isImovel ? 1 : 0)

        return baseParcela * factor + seguroVida + seguroGarantia
    }

    const formatCurrencyBRL = (v: number) =>
        v.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        })

    // HANDLERS
    const handleCurrencyChange = (value: string, setter: (v: string) => void) => {
        const numericValue = value.replace(/\D/g, "")
        const floatValue = Number(numericValue) / 100
        setter(
            floatValue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
        )
    }

    const handleCalcular = () => {
        const inputCredito = parseCurrencyInput(valorCredito)
        const inputPrazo = Number(prazo)
        const inputTaxa = Number(taxaAdm)

        const inputINCC = Number(taxaINCC.replace(",", "."))
        const inputContemplacao = Number(tempoContemplacao)

        if (inputPrazo < 1) {
            setPrazoError("Informe o prazo em meses.")
            return
        }
        setPrazoError("")

        const inputs: ConstrucaoInputs = {
            credito: inputCredito,
            prazo: inputPrazo,
            taxa: inputTaxa,
            incc: inputINCC,
            contemplacao: inputContemplacao,
            reajuste: tipoReajuste
        }

        try {
            const outputs = calcularConstrucao(inputs)

            // Para construção, os lances devem ser baseados no CRÉDITO ATUALIZADO NA CONTEMPLAÇÃO
            const baseCreditoLance = outputs.creditoAtualizado
            const valorLanceLivreCalc = baseCreditoLance * (lanceLivrePercentNumber / 100)
            const valorLanceEmbutidoCalc = baseCreditoLance * (lanceEmbutidoPercentNumber / 100)
            const valorLanceFixoCalc = baseCreditoLance * (lanceFixoPercentNumber / 100)

            // Lógica de Lances Mista
            const isLanceMode = modoContemplacao === "lance_livre" || modoContemplacao === "lance_fixo"
            const totalLance = modoContemplacao === "lance_fixo" ? valorLanceFixoCalc : valorLanceLivreCalc + valorLanceEmbutidoCalc
            const valorLanceEmbutidoEfetivo = modoContemplacao === "lance_fixo" ? 0 : valorLanceEmbutidoCalc
            const valorLanceLivreEfetivo = modoContemplacao === "lance_fixo" ? valorLanceFixoCalc : valorLanceLivreCalc

            // Converte valor de lance em "qtd de parcelas" para abater prazo (mesma ideia do simulador normal)
            // Aqui usamos uma parcela referência com Plano Light + Seguro (mesma lógica do simulador normal)
            const parcelaReferencia = calcParcelaComPlanoESeguro(outputs.creditoAtualizado, inputs.prazo, inputs.taxa)
            const totalBidParcels = parcelaReferencia > 0 ? round0(totalLance / parcelaReferencia) : 0
            const D20_qtd_parcelas_embutido = parcelaReferencia > 0 ? round0(valorLanceEmbutidoEfetivo / parcelaReferencia) : 0

            const diluirLanceNumber = Number(diluirLance) || 3

            let parcelasAbatidas = 0
            if (totalBidParcels > 0) {
                if (diluirLanceNumber === 2) {
                    parcelasAbatidas = 0
                } else if (diluirLanceNumber === 1) {
                    parcelasAbatidas = D20_qtd_parcelas_embutido
                } else {
                    parcelasAbatidas = totalBidParcels
                }
            }

            const qtdParcelasPagasComLance = outputs.qtdParcelasPagas + parcelasAbatidas
            const parcelasAPagarQtdComLance = Math.max(0, inputs.prazo - qtdParcelasPagasComLance)
            const novaParcelaComPlanoESeguro = calcParcelaComPlanoESeguro(outputs.creditoAtualizado, inputs.prazo, inputs.taxa)
            const saldoDevedorComLance = novaParcelaComPlanoESeguro * parcelasAPagarQtdComLance

            const outputsComLance: ConstrucaoOutputs = {
                ...outputs,
                parcelaIntegral: calcParcelaComPlanoESeguro(inputs.credito, inputs.prazo, inputs.taxa),
                novaParcela: novaParcelaComPlanoESeguro,
                valorLanceTotal: isLanceMode ? totalLance : 0,
                valorLanceEmbutido: isLanceMode ? valorLanceEmbutidoEfetivo : 0,
                valorLancePago: isLanceMode ? valorLanceLivreEfetivo : 0,
                creditoDisponivel: isLanceMode ? baseCreditoLance - valorLanceEmbutidoEfetivo : baseCreditoLance,
                // Nota: O creditoAtualizado vem da função com INCC. Se houver embutido, deduzimos dele.
                // A lógica simples aqui deduz do valor base atualizado.

                custoTotal: outputs.custoTotal + (isLanceMode ? valorLanceLivreEfetivo : 0),
                qtdParcelasPagas: isLanceMode ? qtdParcelasPagasComLance : outputs.qtdParcelasPagas,
                parcelasAPagarQtd: isLanceMode ? parcelasAPagarQtdComLance : outputs.parcelasAPagarQtd,
                prazoRestante: isLanceMode ? parcelasAPagarQtdComLance : outputs.prazoRestante,
                saldoDevedor: isLanceMode ? saldoDevedorComLance : outputs.saldoDevedor,

                // Novos cálculos de valorização
                valorizacaoReal: calcularValorizacao(outputs.creditoAtualizado, Number(valorizacaoBem) || 0),
                creditoComValorizacao: outputs.creditoAtualizado + calcularValorizacao(outputs.creditoAtualizado, Number(valorizacaoBem) || 0),
                rendaMensalImovel: Number(rendaMensalImovel) || 0,
                reinvestimentoMensal: Number(reinvestimentoMensal) || 0,
                modoContemplacao
            }

            onSimular(outputsComLance)
        } catch (error: any) {
            alert(error.message)
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
            <div className="flex flex-col gap-8 w-full max-w-xl shrink-0">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Hammer className="w-5 h-5" />
                            Parâmetros da Construção (Etapa 1)
                        </CardTitle>
                        <CardDescription>Defina os valores base para a simulação de construção.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Crédito */}
                            <div className="space-y-2">
                                <Label htmlFor="credito" className="h-12 flex items-end pb-1 leading-tight">Crédito do Consórcio (R$)</Label>
                                <Input
                                    id="credito"
                                    value={valorCredito}
                                    onChange={(e) => handleCurrencyChange(e.target.value, setValorCredito)}
                                    placeholder="0,00"
                                    inputMode="numeric"
                                />
                            </div>

                            {/* Prazo */}
                            <div className="space-y-2">
                                <Label htmlFor="prazo" className="h-12 flex items-end pb-1 leading-tight">Prazo (meses)</Label>
                                <Input
                                    id="prazo"
                                    type="number"
                                    value={prazo}
                                    onChange={(e) => {
                                        setPrazo(e.target.value)
                                        if (prazoError) setPrazoError("")
                                    }}
                                    placeholder="Ex: 180"
                                    aria-invalid={prazoError ? true : undefined}
                                    className={prazoError ? "border-red-500 focus-visible:ring-red-500" : undefined}
                                />
                                {prazoError && <p className="text-xs text-red-600">{prazoError}</p>}
                            </div>

                            {/* Taxa */}
                            <div className="space-y-2">
                                <Label htmlFor="taxa">Taxa (Valor Fixo/Mensal?)</Label>
                                <Input
                                    id="taxa"
                                    type="number"
                                    value={taxaAdm}
                                    onChange={(e) => setTaxaAdm(e.target.value)}
                                    placeholder="0"
                                    step="0.01"
                                />
                                <p className="text-xs text-muted-foreground">Adicionado à nova parcela (R$)</p>
                            </div>

                            {/* INCC */}
                            <div className="space-y-2">
                                <Label htmlFor="incc">Índice Reajuste (INCC %)</Label>
                                <Input
                                    id="incc"
                                    type="number"
                                    value={taxaINCC}
                                    onChange={(e) => setTaxaINCC(e.target.value)}
                                    placeholder="2.5"
                                    step="0.1"
                                />
                            </div>

                            {/* Contemplação */}
                            <div className="space-y-2">
                                <Label htmlFor="contemplacao">Contemplação (mês)</Label>
                                <Input
                                    id="contemplacao"
                                    type="number"
                                    value={tempoContemplacao}
                                    onChange={(e) => setTempoContemplacao(e.target.value)}
                                    placeholder="Ex: 36"
                                />
                            </div>

                            {/* Toggle Reajuste */}
                            <div className="space-y-2 flex flex-col justify-end pb-2">
                                <Label className="mb-3 block">Tipo de Reajuste</Label>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="reajuste-mode" className={tipoReajuste === "semestral" ? "font-bold" : "text-muted-foreground"}>Semestral</Label>
                                    <Switch
                                        id="reajuste-mode"
                                        checked={tipoReajuste === "anual"}
                                        onCheckedChange={(checked: boolean) =>
                                            setTipoReajuste(checked ? "anual" : "semestral")
                                        }
                                    />
                                    <Label htmlFor="reajuste-mode" className={tipoReajuste === "anual" ? "font-bold" : "text-muted-foreground"}>Anual</Label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 w-full">
                            <div>
                                <Label className="block">Modalidade de contemplação</Label>
                                <p className="text-xs text-muted-foreground">Escolha como a contemplação será simulada.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setModoContemplacao("sorteio")}
                                    className={
                                        "rounded-xl border px-4 py-6 text-center transition-all w-full flex flex-col items-center justify-center gap-3 group " +
                                        (modoContemplacao === "sorteio"
                                            ? "border-amber-400 bg-amber-50 shadow-sm ring-1 ring-amber-400/50"
                                            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300")
                                    }
                                >
                                    <div
                                        className={
                                            "h-12 w-12 rounded-xl flex items-center justify-center transition-colors " +
                                            (modoContemplacao === "sorteio" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200")
                                        }
                                    >
                                        <Dices className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-semibold text-sm sm:text-base">Sorteio</div>
                                        <div className="text-xs text-muted-foreground leading-tight">Sem lance</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setModoContemplacao("lance_fixo")}
                                    className={
                                        "rounded-xl border px-4 py-6 text-center transition-all w-full flex flex-col items-center justify-center gap-3 group " +
                                        (modoContemplacao === "lance_fixo"
                                            ? "border-sky-400 bg-sky-50 shadow-sm ring-1 ring-sky-400/50"
                                            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300")
                                    }
                                >
                                    <div
                                        className={
                                            "h-12 w-12 rounded-xl flex items-center justify-center transition-colors " +
                                            (modoContemplacao === "lance_fixo" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200")
                                        }
                                    >
                                        <Target className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-semibold text-sm sm:text-base">Lance Fixo</div>
                                        <div className="text-xs text-muted-foreground leading-tight">Percentual Definido</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setModoContemplacao("lance_livre")}
                                    className={
                                        "rounded-xl border px-4 py-6 text-center transition-all w-full flex flex-col items-center justify-center gap-3 group " +
                                        (modoContemplacao === "lance_livre"
                                            ? "border-emerald-400 bg-emerald-50 shadow-sm ring-1 ring-emerald-400/50"
                                            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300")
                                    }
                                >
                                    <div
                                        className={
                                            "h-12 w-12 rounded-xl flex items-center justify-center transition-colors " +
                                            (modoContemplacao === "lance_livre"
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-slate-100 text-slate-600 group-hover:bg-slate-200")
                                        }
                                    >
                                        <SlidersHorizontal className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-semibold text-sm sm:text-base">Lance Livre</div>
                                        <div className="text-xs text-muted-foreground leading-tight">Campos Editáveis</div>
                                    </div>
                                </button>
                            </div>

                            {modoContemplacao === "lance_fixo" && (
                                <div className="md:col-span-2">
                                    <div
                                        data-slot="card"
                                        className="text-card-foreground flex flex-col gap-6 rounded-xl border py-6 border-sky-500/70 bg-sky-50 mt-2 shadow-sm"
                                    >
                                        <div className="px-6 min-w-0">
                                            <div className="font-semibold">Lance Fixo</div>
                                            <div className="text-xs text-muted-foreground">{lanceFixoPercentNumber}% do crédito</div>
                                        </div>

                                        <div className="px-6 space-y-2">
                                            <div className="text-sm text-muted-foreground">
                                                Lance total (R$): <span className="font-semibold text-foreground">{formatCurrencyBRL(valorLanceFixo)}</span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Qtd. de parcelas (estimado):{" "}
                                                <span className="font-semibold text-foreground">
                                                    {(() => {
                                                        const p = Number(prazo)
                                                        const c = parseCurrencyInput(valorCredito)
                                                        const t = Number(taxaAdm)
                                                        if (p < 1 || c <= 0) return 0
                                                        const parcelaRef = (c / p) * (1 + t / 100)
                                                        if (parcelaRef <= 0) return 0
                                                        return Math.round(valorLanceFixo / parcelaRef)
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modoContemplacao === "lance_livre" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="lanceLivrePercent" className="h-12 flex items-end pb-1 leading-tight">Percentual do lance (%)</Label>
                                        <Input
                                            id="lanceLivrePercent"
                                            type="number"
                                            step="0.1"
                                            value={lanceLivrePercent}
                                            onChange={(e) => setLanceLivrePercent(e.target.value)}
                                            placeholder="Ex: 20"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="lanceEmbutidoPercent" className="h-12 flex items-end pb-1 leading-tight">Percentual do lance embutido (%)</Label>
                                        <Input
                                            id="lanceEmbutidoPercent"
                                            type="number"
                                            step="0.1"
                                            value={lanceEmbutidoPercent}
                                            onChange={(e) => setLanceEmbutidoPercent(e.target.value)}
                                            placeholder="Ex: 10"
                                            className={
                                                (Number(lanceLivrePercent) || 0) + (Number(lanceEmbutidoPercent) || 0) > 100
                                                    ? "border-red-500 focus-visible:ring-red-500"
                                                    : ""
                                            }
                                        />
                                    </div>

                                    {(Number(lanceLivrePercent) || 0) + (Number(lanceEmbutidoPercent) || 0) > 100 && (
                                        <div className="md:col-span-2 text-sm text-red-500 font-medium">
                                            O valor total do lance não pode ultrapassar o valor do Crédito (100%).
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="planoLight">Plano Redução</Label>
                                        <select
                                            id="planoLight"
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={planoLight}
                                            onChange={(e) => setPlanoLight(e.target.value)}
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
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={seguroPrestamista}
                                            onChange={(e) => setSeguroPrestamista(e.target.value)}
                                        >
                                            <option value="2">Imóvel</option>
                                            <option value="3">Nenhum</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="diluirLance">Forma de Abatimento do Lance</Label>
                                        <select
                                            id="diluirLance"
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={diluirLance}
                                            onChange={(e) => setDiluirLance(e.target.value)}
                                        >
                                            <option value="1">Sim (Abater Prazo)</option>
                                            <option value="2">LUDC</option>
                                            <option value="3">Não (Abater Parcelas)</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div
                                            data-slot="card"
                                            className="text-card-foreground flex flex-col gap-6 rounded-xl border py-6 border-sky-500/70 bg-sky-50 mt-2 shadow-sm"
                                        >
                                            <div className="px-6 min-w-0">
                                                <div className="font-semibold">Lance Livre</div>
                                                <div className="text-xs text-muted-foreground">Campos editáveis</div>
                                            </div>

                                            <div className="px-6 space-y-2">
                                                <div className="text-sm text-muted-foreground">
                                                    Lance livre (R$): <span className="font-semibold text-foreground">{formatCurrencyBRL(valorLanceLivre)}</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Lance embutido (R$): <span className="font-semibold text-foreground">{formatCurrencyBRL(valorLanceEmbutido)}</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Total de lances (R$):{" "}
                                                    <span className="font-semibold text-foreground">{formatCurrencyBRL(valorLanceLivre + valorLanceEmbutido)}</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Qtd. de parcelas (estimado):{" "}
                                                    <span className="font-semibold text-foreground">
                                                        {(() => {
                                                            const parcelaRef = (() => {
                                                                const p = Number(prazo)
                                                                const c = parseCurrencyInput(valorCredito)
                                                                const t = Number(taxaAdm)
                                                                if (p > 0 && c > 0) return (c / p) * (1 + t / 100)
                                                                return 0
                                                            })()
                                                            if (parcelaRef <= 0) return 0
                                                            return Math.round((valorLanceLivre + valorLanceEmbutido) / parcelaRef)
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="pt-2 border-t border-sky-500/20 space-y-1">
                                                    <div className="text-sm text-muted-foreground">
                                                        Qtd parcelas pagas (com lance):{" "}
                                                        <span className="font-semibold text-foreground">
                                                            {(() => {
                                                                const p = Number(prazo)
                                                                const c = parseCurrencyInput(valorCredito)
                                                                const t = Number(taxaAdm)
                                                                const cont = Number(tempoContemplacao)
                                                                if (p < 1 || c <= 0) return cont || 0
                                                                const parcelaRef = (c / p) * (1 + t / 100)
                                                                const abat = parcelaRef > 0 ? Math.round((valorLanceLivre + valorLanceEmbutido) / parcelaRef) : 0
                                                                return (cont || 0) + abat
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Parcelas a pagar (com lance):{" "}
                                                        <span className="font-semibold text-foreground">
                                                            {(() => {
                                                                const p = Number(prazo)
                                                                const c = parseCurrencyInput(valorCredito)
                                                                const t = Number(taxaAdm)
                                                                const cont = Number(tempoContemplacao)
                                                                if (p < 1 || c <= 0) return Math.max(0, p - (cont || 0))
                                                                const parcelaRef = (c / p) * (1 + t / 100)
                                                                const abat = parcelaRef > 0 ? Math.round((valorLanceLivre + valorLanceEmbutido) / parcelaRef) : 0
                                                                return Math.max(0, p - ((cont || 0) + abat))
                                                            })()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Hammer className="w-5 h-5" />
                            Parâmetros da Construção (Etapa 2)
                        </CardTitle>
                        <CardDescription>Defina valores adicionais do imóvel.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="valorizacaoBem">Valorização sobre o Imóvel (%)</Label>
                            <Input
                                id="valorizacaoBem"
                                type="number"
                                step="0.1"
                                value={valorizacaoBem}
                                onChange={(e) => setValorizacaoBem(e.target.value)}
                                placeholder="Ex: 20"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="rendaMensalImovel">Renda mensal do imóvel (%)</Label>
                            <Input
                                id="rendaMensalImovel"
                                type="number"
                                step="0.1"
                                value={rendaMensalImovel}
                                onChange={(e) => setRendaMensalImovel(e.target.value)}
                                placeholder="Ex: 0.5"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reinvestimentoMensal">Reinvestimento Mensal (%)</Label>
                            <Input
                                id="reinvestimentoMensal"
                                type="number"
                                step="0.1"
                                value={reinvestimentoMensal}
                                onChange={(e) => setReinvestimentoMensal(e.target.value)}
                                placeholder="Ex: 0.5"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Button onClick={handleCalcular} className="w-full" size="lg">
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular Construção
                </Button>

                {onGerarPDF && (
                    <Button
                        type="button"
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                        size="lg"
                        onClick={onGerarPDF}
                    >
                        Gerar PDF
                    </Button>
                )}

            </div>
        </div>
    )
}
