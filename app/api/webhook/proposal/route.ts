import { NextResponse } from "next/server"
import { proposalSchema } from "@/lib/webhook-schemas"
import { getCurrentUser } from "@/lib/server-auth"
import { checkRateLimitAndQuota, logPdfGeneration } from "@/lib/rate-limit"

const WEBHOOK_URL_PADRAO = process.env.WEBHOOK_URL_PADRAO
const TIMEOUT_MS = 15000 // 15 seconds

export async function POST(request: Request) {
    let controller: AbortController | null = null

    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ message: "Não autorizado" }, { status: 401 })
        }

        // Security Check: Rate Limit & Quota
        const securityCheck = await checkRateLimitAndQuota(user.uid)
        if (!securityCheck.success) {
            if (securityCheck.error === "RATE_LIMIT") {
                return NextResponse.json({ message: "Aguarde 5 segundos entre gerações de PDF." }, { status: 429 })
            }
            if (securityCheck.error === "QUOTA_EXCEEDED") {
                return NextResponse.json({ message: "Limite diário de 30 PDFs atingido." }, { status: 429 })
            }
        }

        const body = await request.json()

        const validation = proposalSchema.safeParse(body)

        if (!validation.success) {
            console.error("Payload validation error:", validation.error.format())
            return NextResponse.json(
                {
                    message: "Payload inválido. Verifique os dados enviados.",
                    errors: validation.error.format()
                },
                { status: 400 }
            )
        }

        if (!WEBHOOK_URL_PADRAO) {
            console.error("WEBHOOK_URL_PADRAO is not defined")
            return NextResponse.json({ message: "Erro de configuração do servidor." }, { status: 500 })
        }

        controller = new AbortController()
        const timeoutId = setTimeout(() => controller?.abort(), TIMEOUT_MS)

        try {
            const response = await fetch(WEBHOOK_URL_PADRAO, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(validation.data),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                console.error(`Webhook error: ${response.status} ${response.statusText}`)
                return NextResponse.json({ message: "Erro ao comunicar com serviço de PDF." }, { status: 502 })
            }

            // Log successful generation for quota tracking
            await logPdfGeneration(user.uid, "STANDARD")

            return NextResponse.json({ success: true })

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error("Webhook upstream timeout")
                return NextResponse.json(
                    { message: "O serviço de PDF demorou muito para responder. Tente novamente." },
                    { status: 504 }
                )
            }
            throw fetchError
        }

    } catch (error) {
        console.error("Internal server error forwarding webhook:", error)
        return NextResponse.json(
            { message: "Erro interno ao processar solicitação." },
            { status: 500 }
        )
    }
}
