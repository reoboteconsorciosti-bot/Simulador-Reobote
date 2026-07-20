import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import type { User } from "@/lib/auth-types"
import { setSessionCookieOnResponse } from "@/lib/server-auth"
import { verifyCrmSsoToken } from "@/lib/crm-sso"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("crm_sso_token")

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=sso_invalid", url))
  }

  const payload = verifyCrmSsoToken(token)
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=sso_invalid", url))
  }

  const email = payload.email.trim().toLowerCase()
  const dbUser = await prisma.user.findUnique({ where: { email } })
  if (!dbUser) {
    return NextResponse.redirect(new URL("/login?error=sso_user_not_found", url))
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

  const response = NextResponse.redirect(new URL("/app", url))
  setSessionCookieOnResponse(response, user)
  return response
}
