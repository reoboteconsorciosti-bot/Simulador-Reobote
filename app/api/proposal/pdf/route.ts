import { NextResponse } from "next/server"

import { proposalSchema, proposalConstrucaoSchema } from "@/lib/webhook-schemas"
import { getCurrentUser } from "@/lib/server-auth"
import { checkRateLimitAndQuota, logPdfGeneration } from "@/lib/rate-limit"
import { renderProposalPdf } from "@/lib/render-proposal-pdf"

export const runtime = "nodejs"
export const maxDuration = 60

function safeFileName(name: string): string {
  return name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "cliente"
}

/**
 * POST /api/proposal/pdf?tipo=automovel|construcao
 * Recebe o payload da simulação, preenche o HTML de designerProposta/ e devolve o PDF
 * na própria resposta (temporário: nada do PDF é salvo). O banco guarda apenas o log
 * (usuário, tipo, data) em PdfGenerationLog, usado para rate limit/cota.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ message: "Não autorizado" }, { status: 401 })
    }

    const tipo = new URL(request.url).searchParams.get("tipo")
    if (tipo !== "automovel" && tipo !== "construcao") {
      return NextResponse.json({ message: "Parâmetro 'tipo' inválido." }, { status: 400 })
    }

    const securityCheck = await checkRateLimitAndQuota(user.uid)
    if (!securityCheck.success) {
      if (securityCheck.error === "RATE_LIMIT") {
        return NextResponse.json({ message: "Aguarde 5 segundos entre gerações de PDF." }, { status: 429 })
      }
      if (securityCheck.error === "QUOTA_EXCEEDED") {
        return NextResponse.json({ message: "Limite diário de 30 PDFs atingido." }, { status: 429 })
      }
    }

    const body = await request.json().catch(() => null)
    const schema = tipo === "construcao" ? proposalConstrucaoSchema : proposalSchema
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { message: "Payload inválido. Verifique os dados enviados.", errors: validation.error.format() },
        { status: 400 },
      )
    }

    const pdf = await renderProposalPdf(tipo, validation.data as Record<string, unknown>)

    await logPdfGeneration(user.uid, tipo === "construcao" ? "CONSTRUCTION" : "STANDARD")

    // Nome do arquivo segue o bem escolhido (imóvel/automóvel), não o template usado.
    const bem =
      tipo === "construcao"
        ? "construcao"
        : String(validation.data.tipoBem ?? "").toLowerCase().startsWith("im")
          ? "imovel"
          : "automovel"
    const fileName = `proposta-${bem}-${safeFileName(validation.data.nome)}.pdf`
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("POST /api/proposal/pdf failed", error)
    return NextResponse.json({ message: "Erro interno ao gerar o PDF." }, { status: 500 })
  }
}
