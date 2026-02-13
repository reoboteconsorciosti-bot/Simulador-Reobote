"use client"

import { useState } from "react"
import { Calculator, CheckCircle, Dices, Hammer, SlidersHorizontal, Target, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { parseCurrencyInput } from "@/lib/formatters"
import { calcularConstrucao, calcularCreditoAtualizado, calcularValorizacao, calcularRendaMensal, calcularRendaLiquidaMensal, type ConstrucaoInputs, type ConstrucaoOutputs } from "./calcConstrucao"
import { gerarPdfConstrucao } from "@/lib/gerar-pdf-construcao"
import { calcularValorizacaoAnualComposta } from "@/lib/calcular-valorizacao-anual-composta"

type ModoContemplacao = "sorteio" | "lance_fixo" | "lance_livre"

interface ConsorcioPConstrucaoProps {
    onSimular: (dados: ConstrucaoOutputs, pdfPayload: any) => void
    nomeCliente: string
    nomeConsultor: string
    tipoBem: "imovel" | "automovel"
}

export function ConsorcioPConstrucao({ onSimular, nomeCliente, nomeConsultor, tipoBem }: ConsorcioPConstrucaoProps) {
    // STATE - Inputs
    const [valorCredito, setValorCredito] = useState("")
    const [prazo, setPrazo] = useState("")
    const [prazoError, setPrazoError] = useState<string>("")
    const [creditoError, setCreditoError] = useState<string>("")
    const [taxaAdm, setTaxaAdm] = useState("") // Taxa Fixa ou Mensal? Assumir valor monetário pela fórmula (Taxa + ...)
    const [taxaINCC, setTaxaINCC] = useState("") // %
    const [tempoContemplacao, setTempoContemplacao] = useState("")
    const [tipoReajuste, setTipoReajuste] = useState<"anual" | "semestral">("semestral")

    const [planoLight, setPlanoLight] = useState<string>("1")
    const [seguroPrestamista, setSeguroPrestamista] = useState<string>("3")
    const [diluirLance, setDiluirLance] = useState<string>("3")

    const [modoContemplacao, setModoContemplacao] = useState<ModoContemplacao>("sorteio")
    const [lanceEmbutidoPercent, setLanceEmbutidoPercent] = useState("")
    const [lanceLivrePercent, setLanceLivrePercent] = useState("")
    const [valorizacaoBem, setValorizacaoBem] = useState("")
    const [rendaMensalImovel, setRendaMensalImovel] = useState("")
    const [valorizacaoAnual, setValorizacaoAnual] = useState("")
    const [reinvestimentoMensal, setReinvestimentoMensal] = useState("")
    const [reinvestimentoMensalSecundario, setReinvestimentoMensalSecundario] = useState("")

    const [generatingPdfConstrucao, setGeneratingPdfConstrucao] = useState(false)
    const [showPdfSuccessModalConstrucao, setShowPdfSuccessModalConstrucao] = useState(false)
    const [showPdfErrorModalConstrucao, setShowPdfErrorModalConstrucao] = useState(false)
    const [pdfErrorMessageConstrucao, setPdfErrorMessageConstrucao] = useState("")

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

    const getOutputsComLance = (): ConstrucaoOutputs | null => {
        const inputCredito = parseCurrencyInput(valorCredito)
        const inputPrazo = Number(prazo)
        const inputTaxa = Number(taxaAdm)
        const inputINCC = Number(taxaINCC.replace(",", "."))
        const inputContemplacao = Number(tempoContemplacao)

        if (inputPrazo < 1) {
            setPrazoError("Informe o prazo em meses.")
            return null
        }
        setPrazoError("")

        if (inputCredito <= 0) {
            setCreditoError("Informe o crédito do consórcio.")
            return null
        }
        setCreditoError("")

        const inputs: ConstrucaoInputs = {
            credito: inputCredito,
            prazo: inputPrazo,
            taxa: inputTaxa,
            incc: inputINCC,
            contemplacao: inputContemplacao,
            reajuste: tipoReajuste
        }

        const outputs = calcularConstrucao(inputs)

        const baseCreditoLance = outputs.creditoAtualizado
        const valorLanceLivreCalc = baseCreditoLance * (lanceLivrePercentNumber / 100)
        const valorLanceEmbutidoCalc = baseCreditoLance * (lanceEmbutidoPercentNumber / 100)
        const valorLanceFixoCalc = baseCreditoLance * (lanceFixoPercentNumber / 100)

        const isLanceMode = modoContemplacao === "lance_livre" || modoContemplacao === "lance_fixo"
        let totalLance = 0
        let valorLanceEmbutidoEfetivo = 0
        let valorLanceLivreEfetivo = 0

        if (modoContemplacao === "lance_fixo") {
            totalLance = valorLanceFixoCalc
            valorLanceEmbutidoEfetivo = valorLanceFixoCalc
            valorLanceLivreEfetivo = 0
        } else if (modoContemplacao === "lance_livre") {
            totalLance = valorLanceLivreCalc + valorLanceEmbutidoCalc
            valorLanceEmbutidoEfetivo = valorLanceEmbutidoCalc
            valorLanceLivreEfetivo = valorLanceLivreCalc
        }

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

        const creditoPosEmbutido = baseCreditoLance - valorLanceEmbutidoEfetivo
        const valorizacaoRealCalc = calcularValorizacao(creditoPosEmbutido, Number(valorizacaoBem) || 0)
        const creditoComValorizacaoCalc = creditoPosEmbutido + valorizacaoRealCalc

        const mesesRestantes = Math.max(0, inputs.prazo - (Number(tempoContemplacao) || 0))
        const anosRestantes = Math.max(0, Math.floor(mesesRestantes / 12))
        const { valorFinal: creditoComValorizacaoFinal, historico: historicoValorizacaoAnual } = calcularValorizacaoAnualComposta({
            valorInicial: creditoComValorizacaoCalc,
            percentualAnual: Number(valorizacaoAnual.toString().replace(",", ".")) || 0,
            anos: anosRestantes,
        })

        const rendaMensalGeradaCalc = calcularRendaMensal(
            creditoComValorizacaoCalc,
            Number(rendaMensalImovel) || 0
        )

        const outputsComLance: ConstrucaoOutputs = {
            ...outputs,
            parcelaIntegral: calcParcelaComPlanoESeguro(inputs.credito, inputs.prazo, inputs.taxa),
            novaParcela: novaParcelaComPlanoESeguro,
            valorLanceTotal: isLanceMode ? totalLance : 0,
            valorLanceEmbutido: isLanceMode ? valorLanceEmbutidoEfetivo : 0,
            valorLancePago: isLanceMode ? valorLanceLivreEfetivo : 0,
            creditoDisponivel: isLanceMode ? creditoPosEmbutido : baseCreditoLance,
            custoTotal: outputs.custoTotal + (isLanceMode ? valorLanceLivreEfetivo : 0),
            qtdParcelasPagas: isLanceMode ? qtdParcelasPagasComLance : outputs.qtdParcelasPagas,
            parcelasAPagarQtd: isLanceMode ? parcelasAPagarQtdComLance : outputs.parcelasAPagarQtd,
            prazoRestante: isLanceMode ? parcelasAPagarQtdComLance : outputs.prazoRestante,
            saldoDevedor: isLanceMode ? saldoDevedorComLance : outputs.saldoDevedor,
            valorizacaoReal: valorizacaoRealCalc,
            creditoComValorizacao: creditoComValorizacaoCalc,
            creditoComValorizacaoFinal: creditoComValorizacaoFinal,
            historicoValorizacaoAnual,
            rendaMensalImovel: Number(rendaMensalImovel) || 0,
            rendaMensalGerada: rendaMensalGeradaCalc,
            rendaMensalAluguel: calcularRendaLiquidaMensal(rendaMensalGeradaCalc, novaParcelaComPlanoESeguro),
            reinvestimentoMensal: calcularRendaLiquidaMensal(rendaMensalGeradaCalc, novaParcelaComPlanoESeguro),
            modoContemplacao,
            valorizacaoAnual: creditoComValorizacaoCalc * ((Number(valorizacaoAnual) || 0) / 100)
        }

        return outputsComLance
    }

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
        try {
            const outputsComLance = getOutputsComLance()
            if (!outputsComLance) return

            const pdfPayload = {
                inputs: {
                    nomeCliente,
                    nomeConsultor,
                    credito: parseCurrencyInput(valorCredito),
                    prazoMeses: Number(prazo),
                    contemplacaoMes: Number(tempoContemplacao) || 0,
                    modoContemplacao,
                    planoReducao: planoLight,
                    seguroPrestamista,
                    formaAbatimento: diluirLance,
                    valorizacaoPercent: valorizacaoBem,
                    tipoBem: "construcao",
                },
                outputs: outputsComLance,
            }

            onSimular(outputsComLance, pdfPayload)
        } catch (error: any) {
            alert(error.message)
        }
    }

    const canGeneratePdfConstrucao = (() => {
        if (generatingPdfConstrucao) return false
        if (parseCurrencyInput(valorCredito) <= 0) return false
        if (Number(prazo) < 1) return false
        if (!taxaAdm.toString().trim()) return false
        if (!taxaINCC.toString().trim()) return false
        if (Number(tempoContemplacao) < 0 || tempoContemplacao.toString().trim() === "") return false
        if (!valorizacaoBem.toString().trim()) return false
        if (!rendaMensalImovel.toString().trim()) return false
        if (modoContemplacao === "lance_livre") {
            if (!lanceLivrePercent.toString().trim()) return false
            if (!lanceEmbutidoPercent.toString().trim()) return false
        }
        return true
    })()

    const handleGerarPdfConstrucao = async () => {
        try {
            const outputsComLance = getOutputsComLance()
            if (!outputsComLance) return

            setGeneratingPdfConstrucao(true)
            const res = await gerarPdfConstrucao({
                inputs: {
                    nomeCliente,
                    nomeConsultor,
                    credito: parseCurrencyInput(valorCredito),
                    prazoMeses: Number(prazo),
                    contemplacaoMes: Number(tempoContemplacao) || 0,
                    modoContemplacao,
                    planoReducao: planoLight,
                    seguroPrestamista,
                    formaAbatimento: diluirLance,
                    valorizacaoPercent: valorizacaoBem,
                    tipoBem: "construcao",
                },
                outputs: outputsComLance,
            })

            if (res.ok) {
                setShowPdfSuccessModalConstrucao(true)
            } else {
                const err = await res.json().catch(() => ({}))
                setPdfErrorMessageConstrucao(err.message || "Erro desconhecido ao gerar PDF. Tente novamente.")
                setShowPdfErrorModalConstrucao(true)
            }
        } catch (error) {
            console.error(error)
            setPdfErrorMessageConstrucao("Erro de conexão ao tentar gerar o PDF. Verifique sua internet.")
            setShowPdfErrorModalConstrucao(true)
        } finally {
            setGeneratingPdfConstrucao(false)
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
                                    onChange={(e) => {
                                        handleCurrencyChange(e.target.value, setValorCredito)
                                        if (creditoError) setCreditoError("")
                                    }}
                                    placeholder="0,00"
                                    inputMode="numeric"
                                    className={creditoError ? "border-red-500 focus-visible:ring-red-500" : undefined}
                                />
                                {creditoError && (
                                    <p className="text-xs text-red-600">{creditoError}</p>
                                )}
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
                                <Label htmlFor="taxa">Taxa Administrativa</Label>
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
                                <Label htmlFor="incc">Reajuste (INCC %)</Label>
                                <Input
                                    id="incc"
                                    type="number"
                                    value={taxaINCC}
                                    onChange={(e) => setTaxaINCC(e.target.value)}
                                    placeholder="2.5"
                                    step="0.1"
                                />
                                <div className="space-y-2 flex flex-col justify-end pb-2">
                                    <Label className="mb-2 block">Reajuste</Label>
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="reajuste-mode" className={tipoReajuste === "semestral" ? "font-bold text-emerald-600" : "text-muted-foreground"}>Semestral</Label>
                                        <Switch
                                            id="reajuste-mode"
                                            checked={tipoReajuste === "anual"}
                                            onCheckedChange={(checked: boolean) =>
                                                setTipoReajuste(checked ? "anual" : "semestral")
                                            }
                                            className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-emerald-600"
                                        />
                                        <Label htmlFor="reajuste-mode" className={tipoReajuste === "anual" ? "font-bold text-emerald-600" : "text-muted-foreground"}>Anual</Label>
                                    </div>
                                </div>
                            </div>

                            {/* Contemplação */}
                            <div className="space-y-2 w-130">
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
                                            <option value="1">Sim (Abater Parcelas)</option>
                                            <option value="2">LUDC</option>
                                            <option value="3">Não (Abater Prazo)</option>
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
                            <Label htmlFor="valorizacaoAnual">Valorização Anual do Imóvel (%)</Label>
                            <Input
                                id="valorizacaoAnual"
                                type="number"
                                step="0.1"
                                value={valorizacaoAnual}
                                onChange={(e) => setValorizacaoAnual(e.target.value)}
                                placeholder="Ex: 6"
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


                    </CardContent>
                </Card>

                <Button onClick={handleCalcular} className="w-full" size="lg">
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular Construção
                </Button>

                {/* Botão de PDF removido daqui para o ResultsModal */}

            </div>

            {showPdfSuccessModalConstrucao && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowPdfSuccessModalConstrucao(false)}
                        aria-hidden="true"
                    />
                    <div className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-4 rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/30 dark:text-green-500">
                                <CheckCircle className="h-8 w-8" />
                            </div>

                            <h3 className="text-lg font-semibold text-foreground">Solicitação Enviada!</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Solicitação enviada com sucesso! O PDF será gerado em instantes.
                            </p>

                            <Button
                                className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => setShowPdfSuccessModalConstrucao(false)}
                            >
                                Entendi
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
