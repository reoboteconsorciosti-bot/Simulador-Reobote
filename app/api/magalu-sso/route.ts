import { NextResponse } from "next/server"
import { getCurrentUser, createMagaluSsoToken } from "@/lib/server-auth"

export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const magaluUrl = process.env.MAGALU_URL
  if (!magaluUrl) {
    return new NextResponse("MAGALU_URL not configured", { status: 500 })
  }

  try {
    const token = createMagaluSsoToken(user)
    // Retorna o token e a URL para o cliente montar o redirect
    // Evita problemas de redirecionamento via rede interna Docker
    return NextResponse.json({ token, magaluUrl })
  } catch (error) {
    console.error("Error generating Magalu SSO token: ", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
