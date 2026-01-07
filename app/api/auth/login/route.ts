import { NextResponse } from "next/server"
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto"

import { prisma } from "@/lib/prisma"
import type { User } from "@/lib/auth-types"
import { setSessionCookieOnResponse } from "@/lib/server-auth"

const DEV_BOOTSTRAP_ADMIN_EMAIL = "caikilemos45@gmail.com"

function verifyPassword(password: string, passwordHash: string) {
  // formato: pbkdf2$sha256$<iterations>$<saltB64>$<hashB64>
  const parts = passwordHash.split("$")
  if (parts.length !== 5) return false
  const [, algo, iterationsStr, saltB64, hashB64] = parts
  if (algo !== "sha256") return false
  const iterations = Number(iterationsStr)
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  const salt = Buffer.from(saltB64, "base64")
  const expected = Buffer.from(hashB64, "base64")

  const derived = pbkdf2Sync(password, salt, iterations, expected.length, "sha256")
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

function fallbackHash(password: string) {
  const salt = randomBytes(16)
  const iterations = 120000
  const derived = pbkdf2Sync(password, salt, iterations, 32, "sha256")
  return `pbkdf2$sha256$${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password ?? ""

  if (!email || !email.includes("@") || !password) {
    return NextResponse.json({ message: "Credenciais inválidas." }, { status: 400 })
  }

  let dbUser = await prisma.user.findUnique({ where: { email } })

  // Bootstrap DEV: permite criar/resetar a senha do admin principal localmente.
  // Em produção, isso NÃO deve acontecer.
  if (process.env.NODE_ENV !== "production" && email === DEV_BOOTSTRAP_ADMIN_EMAIL) {
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email,
          name: "Admin",
          role: "Admin",
          teamId: null,
          photoUrl: null,
          passwordHash: fallbackHash(password),
        },
      })
    } else {
      const ok = verifyPassword(password, dbUser.passwordHash)
      if (!ok) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { passwordHash: fallbackHash(password) },
        })
      }
    }
  }

  if (!dbUser) {
    return NextResponse.json({ message: "Falha no login. Verifique suas credenciais." }, { status: 401 })
  }

  const ok = verifyPassword(password, dbUser.passwordHash)
  if (!ok) {
    return NextResponse.json({ message: "Falha no login. Verifique suas credenciais." }, { status: 401 })
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

  const response = NextResponse.json({ user })
  setSessionCookieOnResponse(response, user)
  return response
}

// Exportado para uso futuro (seed/admin UI). Não usado na rota diretamente.
export function hashPassword(password: string) {
  return fallbackHash(password)
}
