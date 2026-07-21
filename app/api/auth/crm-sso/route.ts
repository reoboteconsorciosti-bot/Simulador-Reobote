import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import type { User } from "@/lib/auth-types"
import { setSessionCookieOnResponse } from "@/lib/server-auth"
import { verifyCrmSsoToken } from "@/lib/crm-sso"

export async function GET(request: Request) {
  // Nunca deriva o host do redirect a partir de request.url: atrás de um proxy
  // reverso (ex.: EasyPanel) isso pode resolver pro endereço de bind do
  // container (0.0.0.0:80) em vez do domínio público.
  const appUrl = process.env.APP_URL
  if (!appUrl) {
    return new NextResponse("APP_URL not configured", { status: 500 })
  }

  const redirect = (path: string) => NextResponse.redirect(new URL(path, appUrl))

  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get("crm_sso_token")

  if (!token) {
    return redirect("/login?error=sso_invalid")
  }

  const payload = verifyCrmSsoToken(token)
  if (!payload) {
    return redirect("/login?error=sso_invalid")
  }

  const email = payload.email.trim().toLowerCase()
  const dbUser = await prisma.user.findUnique({ where: { email } })
  if (!dbUser) {
    return redirect("/login?error=sso_user_not_found")
  }

  const user: User = {
    uid: dbUser.id,
    email: dbUser.email,
    profile: {
      name: dbUser.name,
      role: dbUser.role as any,
      teamId: dbUser.teamId ?? undefined,
      photoUrl: dbUser.photoUrl ?? undefined,
    },
  }

  const response = redirect("/app")
  setSessionCookieOnResponse(response, user)
  return response
}
