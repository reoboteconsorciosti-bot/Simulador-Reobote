import { NextResponse } from "next/server"
import { getCurrentUser, createMagaluSsoToken } from "@/lib/server-auth"

export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const magaluUrl = process.env.MAGALU_URL
  if (!magaluUrl) {
    return new NextResponse("MAGALU_URL not configured in environment variables", { status: 500 })
  }

  try {
    const token = createMagaluSsoToken(user)
    
    // --- INÍCIO DEBUG FINGERPRINT MAGALU ---
    const { createHash, createHmac } = require("crypto")
    const payloadB64 = "eyJ1aWQiOiI2YWFmMTg1OC00NTdiLTRlOGQtYjEyNC0yM2JlZDEzNzAxZmIiLCJlbWFpbCI6ImNhaWtpbGVtb3M0NUBnbWFpbC5jb20iLCJyb2xlIjoiQWRtaW4iLCJleHAiOjE3ODI5MzEzMjZ9"
    const secret = process.env.AUTH_SECRET || ""

    console.log("[DEBUG CENTRAL] AUTH_SECRET length:", secret.length)
    console.log("[DEBUG CENTRAL] AUTH_SECRET EXATO PARA O MAGALU (copie isso sem as aspas externas se houver espaços):", JSON.stringify(secret))
    console.log(
      "[DEBUG CENTRAL] signature preview:",
      createHmac("sha256", secret)
        .update(payloadB64)
        .digest("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
    )
    // --- FIM DEBUG FINGERPRINT MAGALU ---

    const redirectUrl = new URL("/auth", magaluUrl)
    redirectUrl.searchParams.set("token", token)

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error("Error generating Magalu SSO token: ", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
