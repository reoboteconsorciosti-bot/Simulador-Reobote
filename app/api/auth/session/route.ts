import { NextResponse } from "next/server"

import type { User } from "@/lib/auth-types"
import { setSessionCookieOnResponse } from "@/lib/server-auth"

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not allowed" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { user?: User } | null
  if (!body?.user?.uid || !body.user.email || !body.user.profile?.role || !body.user.profile?.name) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  setSessionCookieOnResponse(response, body.user)
  return response
}
