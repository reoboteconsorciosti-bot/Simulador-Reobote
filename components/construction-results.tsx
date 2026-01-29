"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatPercentage } from "@/lib/formatters"
import { Hammer, Calendar, Percent, Coins, Shield, TrendingUp, DollarSign } from "lucide-react"

interface ConstructionData {
    valorCredito: number
    prazo: number
    taxaAdm: number
    planoReducao: string
    seguroPrestamista: number | "imovel" | "sem_seguro"
    taxaINCC: number
    contemplacao: {
        tipo: "meses" | "anos"
        valor: number
    }
    lanceEmbutido: number
    lancePago: number
    lanceOfertado: number
    abatimentoLance: string
    mesLance: number
    valorizacaoReal?: number
    creditoComValorizacao?: number
}

interface ConstructionResultsProps {
    data: ConstructionData
    nomeCliente: string
}

export function ConstructionResults({ data, nomeCliente }: ConstructionResultsProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-primary text-primary-foreground">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Hammer className="w-5 h-5" />
                        <span>
                            {(nomeCliente && nomeCliente.trim()) || "Cliente"}, confira o resumo da sua simulação de Construção.
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 items-baseline mb-2 xl:grid-cols-2">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0 text-3xl md:text-4xl font-bold">
                                <span className="min-w-0 break-words">{formatCurrency(data.valorCredito)}</span>
                                <span className="whitespace-nowrap text-lg font-normal opacity-80">Crédito</span>
                            </div>
                        </div>
                        <div className="min-w-0 xl:text-right">
                            <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0 text-3xl md:text-4xl font-bold xl:justify-end">
                                <span className="min-w-0 break-words">{data.prazo}</span>
                                <span className="whitespace-nowrap text-lg font-normal opacity-80">Meses</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
                {/* Detalhes do Crédito e Taxas */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                            <Coins className="w-5 h-5" />
                            Detalhes Financeiros
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Percent className="w-3 h-3" /> Taxa ADM
                                </span>
                                <p className="font-semibold text-lg">{formatPercentage(data.taxaAdm * 100)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> INCC (Anual)
                                </span>
                                <p className="font-semibold text-lg">{formatPercentage(data.taxaINCC * 100)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> Seguro
                                </span>
                                <p className="font-semibold text-lg">
                                    {typeof data.seguroPrestamista === 'number'
                                        ? formatPercentage(data.seguroPrestamista * 100)
                                        : data.seguroPrestamista === 'imovel' ? 'Imóvel' : 'Sem Seguro'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Plano Redução</span>
                                <p className="font-semibold text-lg capitalize">{data.planoReducao}</p>
                            </div>

                            {/* Valorização - Condicional */}
                            {(data.valorizacaoReal || 0) > 0 && (
                                <>
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3 text-emerald-600" /> Valorização Projeta
                                        </span>
                                        <p className="font-semibold text-lg text-emerald-600">
                                            {formatCurrency(data.valorizacaoReal || 0)}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground">Valor estimado do imóvel após a valorização</span>
                                        <p className="font-semibold text-lg text-emerald-700">
                                            {formatCurrency(data.creditoComValorizacao || 0)}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Lances e Contemplação */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                            <DollarSign className="w-5 h-5" />
                            Lances e Previsão
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-sm text-muted-foreground">Lance Embutido</span>
                                <span className="font-medium">{formatPercentage(data.lanceEmbutido * 100)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-sm text-muted-foreground">Lance Pago (Recurso Próprio)</span>
                                <span className="font-medium">{formatPercentage(data.lancePago * 100)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-green-50 p-2 rounded-md">
                                <span className="text-sm font-semibold text-green-800">Lance Total Ofertado</span>
                                <span className="font-bold text-green-700">{formatPercentage(data.lanceOfertado * 100)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Previsão Contemplação
                                </span>
                                <span className="font-medium">
                                    {data.contemplacao.valor} {data.contemplacao.tipo}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
