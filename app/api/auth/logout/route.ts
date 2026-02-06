import { NextResponse } from "next/server"

import { clearSessionCookieOnResponse } from "@/lib/server-auth"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearSessionCookieOnResponse(response)
  return response
}
