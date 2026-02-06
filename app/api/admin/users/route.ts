import { NextResponse } from "next/server"
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/server-auth"
import { UserRole } from "@/lib/auth-types"

function hashPassword(password: string) {
  const salt = randomBytes(16)
  const iterations = 120000
  const derived = pbkdf2Sync(password, salt, iterations, 32, "sha256")
  return `pbkdf2$sha256$${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`
}

function verifyPassword(password: string, passwordHash: string) {
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

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return { ok: false as const, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) }
  if (user.profile.role !== UserRole.Admin) {
    return { ok: false as const, response: NextResponse.json({ message: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const, user }
}

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      photoUrl: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return NextResponse.json({
    items: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      photoUrl: u.photoUrl,
      teamName: u.team?.name ?? null,
    })),
  })
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; password?: string; role?: UserRole; teamName?: string | null; photoUrl?: string }
    | null

  const name = body?.name?.trim() ?? ""
  const email = body?.email?.trim().toLowerCase() ?? ""
  const password = body?.password ?? ""
  const role = body?.role ?? UserRole.Consultor
  let teamName = body?.teamName ?? null
  const photoUrl = body?.photoUrl ?? null

  if (!name) return NextResponse.json({ message: "Informe o nome." }, { status: 400 })
  if (!email || !email.includes("@")) return NextResponse.json({ message: "Informe um e-mail válido." }, { status: 400 })
  if (!password || password.length < 4) {
    return NextResponse.json({ message: "A senha deve ter pelo menos 4 caracteres." }, { status: 400 })
  }

  try {
    let teamId: string | null = null

    // Se o usuário for Supervisor e nenhuma equipe foi informada explicitamente,
    // criamos automaticamente uma equipe com o nome dele.
    if (role === UserRole.Supervisor && !teamName) {
      teamName = `Equipe ${name}`
    }

    if (teamName && teamName.trim()) {
      const normalizedName = teamName.trim()
      const team = await prisma.team.upsert({
        where: { name: normalizedName },
        update: {},
        create: { name: normalizedName },
      })
      teamId = team.id
    }

    const created = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        role: role as any,
        teamId,
        photoUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        photoUrl: true,
        team: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        createdAt: created.createdAt,
        photoUrl: created.photoUrl,
        teamName: created.team?.name ?? null,
      },
    })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ message: "Já existe um usuário com este e-mail." }, { status: 409 })
    }
    console.error("POST /api/admin/users failed", err)
    return NextResponse.json({ message: "Falha ao cadastrar usuário." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => null)) as
    | {
      id?: string
      name?: string
      email?: string
      password?: string
      role?: UserRole
      teamName?: string | null
      photoUrl?: string
    }
    | null

  const id = body?.id ?? ""
  const name = body?.name?.trim() ?? ""
  const email = body?.email?.trim().toLowerCase() ?? ""
  const password = body?.password ?? ""
  const role = body?.role
  const teamName = body?.teamName ?? undefined
  const photoUrl = body?.photoUrl

  if (!id) return NextResponse.json({ message: "Invalid payload" }, { status: 400 })
  if (!name) return NextResponse.json({ message: "Informe o nome." }, { status: 400 })
  if (!email || !email.includes("@")) return NextResponse.json({ message: "Informe um e-mail válido." }, { status: 400 })

  try {
    let teamId: string | null | undefined = undefined

    if (typeof teamName !== "undefined") {
      const trimmedTeam = teamName?.trim() ?? ""
      if (!trimmedTeam) {
        teamId = null
      } else {
        const team = await prisma.team.upsert({
          where: { name: trimmedTeam },
          update: {},
          create: { name: trimmedTeam },
        })
        teamId = team.id
      }
    }

    await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        ...(role ? { role: role as any } : {}),
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        ...(typeof teamId !== "undefined" ? { teamId } : {}),
        ...(typeof photoUrl !== "undefined" ? { photoUrl } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ message: "Já existe um usuário com este e-mail." }, { status: 409 })
    }
    console.error("PUT /api/admin/users failed", err)
    return NextResponse.json({ message: "Falha ao atualizar usuário." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 })

  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE /api/admin/users failed", err)
    return NextResponse.json({ message: "Falha ao excluir usuário." }, { status: 500 })
  }
}
