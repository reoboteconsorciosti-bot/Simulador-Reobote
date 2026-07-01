import { NextResponse } from "next/server"
import { getCurrentUser, createMagaluSsoToken } from "@/lib/server-auth"

export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const magaluUrl = process.env.MAGALU_URL
  
  // Log em produção para diagnóstico
  console.log("[magalu-sso] MAGALU_URL lida em runtime:", magaluUrl)

  if (!magaluUrl) {
    return new NextResponse("MAGALU_URL not configured in environment variables", { status: 500 })
  }

  try {
    const token = createMagaluSsoToken(user)
    const redirectUrl = new URL("/auth", magaluUrl)
    redirectUrl.searchParams.set("token", token)

    console.log("[magalu-sso] Redirecionando para:", redirectUrl.toString())

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error("Error generating Magalu SSO token: ", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
