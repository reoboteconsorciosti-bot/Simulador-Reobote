import { NextResponse } from "next/server"
import { pbkdf2Sync, randomBytes } from "crypto"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/server-auth"
import { UserRole } from "@/lib/auth-types"

type InMemorySimulation = {
  id: string
  userId: string
  inputs: unknown
  outputs: unknown
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    role: string
    teamId: string | null
  }
}

function getInMemoryStore(): InMemorySimulation[] {
  const g = globalThis as unknown as { __simulationsStore?: InMemorySimulation[] }
  if (!g.__simulationsStore) g.__simulationsStore = []
  return g.__simulationsStore
}

function shouldUseInMemoryFallback() {
  return !process.env.DATABASE_URL
}

async function resolveDbUserId(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user || shouldUseInMemoryFallback()) return user?.uid ?? null
  const existing = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } })
  return existing?.id ?? user.uid
}

function randomPasswordHash() {
  const salt = randomBytes(16)
  const iterations = 120000
  const derived = pbkdf2Sync(randomBytes(32), salt, iterations, 32, "sha256")
  return `pbkdf2$sha256$${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      inputs?: unknown
      outputs?: unknown
    } | null

    if (!body || body.inputs == null || body.outputs == null) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 })
    }

    if (shouldUseInMemoryFallback()) {
      const store = getInMemoryStore()
      const id = randomBytes(16).toString("hex")
      const createdAt = new Date().toISOString()
      store.unshift({
        id,
        userId: user.uid,
        inputs: body.inputs,
        outputs: body.outputs,
        createdAt,
        user: {
          id: user.uid,
          name: user.profile.name,
          email: user.email,
          role: user.profile.role,
          teamId: null,
        },
      })

      return NextResponse.json({ ok: true, id, createdAt, storage: "memory" })
    }

    const dbUserId = await resolveDbUserId(user)
    if (!dbUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } })

    if (existingByEmail) {
      // Atualiza dados básicos sem mexer no vínculo de equipe já configurado no painel Admin
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          name: user.profile.name,
          role: user.profile.role,
          photoUrl: user.profile.photoUrl ?? null,
        },
      })
    } else {
      // Garante que o userId do cookie exista no banco.
      // Sem isso, o insert em Simulation falha por FK (userId -> User.id), comum em login mock/local.
      await prisma.user.create({
        data: {
          id: dbUserId,
          email: user.email,
          passwordHash: randomPasswordHash(),
          name: user.profile.name,
          role: user.profile.role,
          teamId: null,
          photoUrl: user.profile.photoUrl ?? null,
        },
      })
    }

    const created = await prisma.simulation.create({
      data: {
        userId: dbUserId,
        inputs: body.inputs as any,
        outputs: body.outputs as any,
      },
      select: { id: true, createdAt: true },
    })

    return NextResponse.json({ ok: true, id: created.id, createdAt: created.createdAt, storage: "postgres" })
  } catch (err: any) {
    console.error("POST /api/simulations failed", err)
    return NextResponse.json(
      {
        message: "Failed to save simulation",
        error: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
        },
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    const role = user.profile.role

    const dbUserId = await resolveDbUserId(user)

    if (shouldUseInMemoryFallback()) {
      const store = getInMemoryStore()
      if (!id) {
        const before = store.length
        if (role === UserRole.Consultor) {
          const kept = store.filter((it) => it.userId !== user.uid)
          ;(globalThis as any).__simulationsStore = kept
          return NextResponse.json({ ok: true, deletedCount: before - kept.length, storage: "memory" })
        }
        ;(globalThis as any).__simulationsStore = []
        return NextResponse.json({ ok: true, deletedCount: before, storage: "memory" })
      }

      const before = store.length
      const kept = store.filter((it) => it.id !== id)
      ;(globalThis as any).__simulationsStore = kept
      return NextResponse.json({ ok: true, deletedCount: before - kept.length, storage: "memory" })
    }

    if (!id) {
      let where: any = {}

      if (role === UserRole.Consultor) {
        where = { userId: dbUserId ?? user.uid }
      } else if (role === UserRole.Supervisor) {
        // Supervisor: atua somente sobre simulações da sua própria equipe (mesmo teamId)
        const supervisor = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, name: true, teamId: true },
        })

        let supervisorTeamId = supervisor?.teamId ?? null

        // Fallback: supervisor antigo sem teamId, tenta localizar equipe "Equipe  {nome}" e fixar o vínculo
        if (!supervisorTeamId && supervisor?.name) {
          const fallbackTeam = await prisma.team.findFirst({ where: { name: `Equipe ${supervisor.name}` } })
          if (fallbackTeam) {
            supervisorTeamId = fallbackTeam.id
            // Opcional: atualiza o usuário supervisor para manter consistência futura
            await prisma.user.update({ where: { id: supervisor.id }, data: { teamId: supervisorTeamId } })
          }
        }

        if (!supervisorTeamId) {
          return NextResponse.json({ ok: true, deletedCount: 0 })
        }

        where = {
          user: {
            teamId: supervisorTeamId,
          },
        }
      } else {
        // Admin/Gerente: tudo
        where = {}
      }

      const deleted = await prisma.simulation.deleteMany({ where })
      return NextResponse.json({ ok: true, deletedCount: deleted.count })
    }

    const existing = await prisma.simulation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        user: { select: { teamId: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ message: "Not found" }, { status: 404 })
    }

    if (role === UserRole.Consultor) {
      if (existing.userId !== (dbUserId ?? user.uid)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else if (role === UserRole.Supervisor) {
      const supervisor = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, name: true, teamId: true },
      })

      let supervisorTeamId = supervisor?.teamId ?? null

      // Fallback: supervisor antigo sem teamId, tenta localizar equipe "Equipe {nome}" e fixar o vínculo
      if (!supervisorTeamId && supervisor?.name) {
        const fallbackTeam = await prisma.team.findFirst({ where: { name: `Equipe ${supervisor.name}` } })
        if (fallbackTeam) {
          supervisorTeamId = fallbackTeam.id
          await prisma.user.update({ where: { id: supervisor.id }, data: { teamId: supervisorTeamId } })
        }
      }

      const teamId = existing.user?.teamId ?? null
      if (!teamId || !supervisorTeamId || teamId !== supervisorTeamId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else {
      // Admin/Gerente: pode apagar qualquer
    }

    await prisma.simulation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE /api/simulations failed", err)
    return NextResponse.json(
      {
        message: "Failed to delete simulation",
        error: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
        },
      },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const takeParam = url.searchParams.get("take")
    const take =
      takeParam === "all"
        ? null
        : Math.min(100, Math.max(1, Number(takeParam ?? "30") || 30))
    const cursor = url.searchParams.get("cursor")

    const role = user.profile.role

    const dbUserId = await resolveDbUserId(user)

    if (shouldUseInMemoryFallback()) {
      const store = getInMemoryStore()
      let scoped = store
      if (role === UserRole.Consultor) {
        scoped = store.filter((it) => it.userId === user.uid)
      }

      const startIndex = cursor ? scoped.findIndex((it) => it.id === cursor) + 1 : 0

      let page: typeof scoped
      let nextCursor: string | null

      if (take == null) {
        // modo ilimitado: retorna tudo a partir do cursor (normalmente cursor ausente)
        page = scoped.slice(Math.max(0, startIndex))
        nextCursor = null
      } else {
        const window = scoped.slice(Math.max(0, startIndex), Math.max(0, startIndex) + take + 1)
        const hasMore = window.length > take
        const sliced = hasMore ? window.slice(0, take) : window
        page = sliced
        nextCursor = hasMore ? sliced[sliced.length - 1]?.id ?? null : null
      }

      return NextResponse.json({
        items: page.map((it) => ({
          id: it.id,
          createdAt: it.createdAt,
          inputs: it.inputs,
          outputs: it.outputs,
          user: it.user,
        })),
        nextCursor,
        storage: "memory",
      })
    }

    let where: any = {}

    if (role === UserRole.Consultor) {
      where = { userId: dbUserId ?? user.uid }
    } else if (role === UserRole.Supervisor) {
      // Supervisor: vê apenas simulações da própria equipe (mesmo teamId que o supervisor)
      const supervisor = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, name: true, teamId: true },
      })

      let supervisorTeamId = supervisor?.teamId ?? null

      // Fallback: supervisor antigo sem teamId, tenta localizar equipe "Equipe  {nome}" e fixar o vínculo
      if (!supervisorTeamId && supervisor?.name) {
        const fallbackTeam = await prisma.team.findFirst({ where: { name: `Equipe ${supervisor.name}` } })
        if (fallbackTeam) {
          supervisorTeamId = fallbackTeam.id
          await prisma.user.update({ where: { id: supervisor.id }, data: { teamId: supervisorTeamId } })
        }
      }

      if (!supervisorTeamId) {
        return NextResponse.json({ items: [], nextCursor: null })
      }

      where = {
        user: {
          teamId: supervisorTeamId,
        },
      }
    } else {
      // Admin/Gerente: tudo
      where = {}
    }

    const items = await prisma.simulation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(take == null
        ? {}
        : {
            take: take + 1,
            ...(cursor
              ? {
                  cursor: { id: cursor },
                  skip: 1,
                }
              : {}),
          }),
      select: {
        id: true,
        createdAt: true,
        inputs: true,
        outputs: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            teamId: true,
          },
        },
      },
    })

    if (take == null) {
      // modo ilimitado: devolve tudo sem paginação
      return NextResponse.json({ items, nextCursor: null })
    }

    const hasMore = items.length > take
    const sliced = hasMore ? items.slice(0, take) : items
    const nextCursor = hasMore ? sliced[sliced.length - 1]?.id ?? null : null

    return NextResponse.json({ items: sliced, nextCursor })
  } catch (err: any) {
    console.error("GET /api/simulations failed", err)
    return NextResponse.json(
      {
        message: "Failed to load simulations",
        error: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
        },
      },
      { status: 500 },
    )
  }
}
