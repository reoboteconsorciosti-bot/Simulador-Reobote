import { NextResponse } from "next/server"

const WEBHOOK_URL = "https://hook.us2.make.com/t9xuuylfl858jukotc2jam5ny2vd7dfd"

export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Validate simple presence of critical fields to ensure payload is structured
        if (!body || !body.nome || !body.credIndic) {
            return NextResponse.json(
                { message: "Payload inválido. Certifique-se de enviar todos os campos obrigatórios." },
                { status: 400 }
            )
        }

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            console.error("Webhook error:", response.status, await response.text())
            return NextResponse.json(
                { message: "Erro ao comunicar com o serviço de geração de PDF." },
                { status: 502 }
            )
        }

        // Make.com might return text or JSON, handling appropriately.
        // Usually it returns "Accepted" or data.
        const responseText = await response.text()

        return NextResponse.json({ success: true, upstream: responseText })
    } catch (error) {
        console.error("Internal server error forwarding webhook:", error)
        return NextResponse.json(
            { message: "Erro interno ao processar solicitação." },
            { status: 500 }
        )
    }
}
