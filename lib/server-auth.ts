import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

import type { User } from "@/lib/auth-types"

const SESSION_COOKIE_NAME = "sim-pro-session"

type SessionPayload = {
  user: User
  exp: number
}

function base64UrlEncode(input: string | Buffer) {
  const b64 = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input).toString("base64")
  return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function base64UrlDecodeToString(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4)
  return Buffer.from(padded, "base64").toString("utf8")
}

function sign(data: string, secret: string) {
  return base64UrlEncode(createHmac("sha256", secret).update(data).digest())
}

export function createSessionToken(user: User, opts?: { maxAgeSeconds?: number }) {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error(
      "Missing AUTH_SECRET. Add AUTH_SECRET to .env.local (or environment variables) and restart the dev server.",
    )
  }

  const maxAgeSeconds = opts?.maxAgeSeconds ?? 60 * 60 * 24 * 7

  // Remove photoUrl from the session token to avoid exceeding the 4kb cookie limit
  // caused by base64 images.
  const sessionUser: User = {
    ...user,
    profile: {
      ...user.profile,
      photoUrl: undefined,
    }
  }

  const payload: SessionPayload = {
    user: sessionUser,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  }

  const payloadJson = JSON.stringify(payload)
  const payloadB64 = base64UrlEncode(payloadJson)
  const signature = sign(payloadB64, secret)
  return `${payloadB64}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null

  const [payloadB64, signature] = token.split(".")
  if (!payloadB64 || !signature) return null

  const expected = sign(payloadB64, secret)

  try {
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  try {
    const payloadStr = base64UrlDecodeToString(payloadB64)
    const payload = JSON.parse(payloadStr) as SessionPayload
    if (!payload?.user?.uid || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const payload = verifySessionToken(token)
  return payload?.user ?? null
}

export function setSessionCookieOnResponse(response: NextResponse, user: User) {
  const token = createSessionToken(user)
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearSessionCookieOnResponse(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
