import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/server-auth"
import { UserRole } from "@/lib/auth-types"

async function resolveDbUserId(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return null
  if (!process.env.DATABASE_URL) return user.uid
  const existing = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } })
  return existing?.id ?? user.uid
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => null)) as { simulationId?: string } | null
    const simulationId = body?.simulationId

    if (!simulationId) {
      return NextResponse.json({ message: "simulationId is required" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ message: "PDF não disponível sem banco configurado" }, { status: 400 })
    }

    const dbUserId = await resolveDbUserId(user)
    if (!dbUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const simulation = await prisma.simulation.findUnique({
      where: { id: simulationId },
      select: {
        id: true,
        userId: true,
        inputs: true,
        outputs: true,
        createdAt: true,
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

    if (!simulation) {
      return NextResponse.json({ message: "Not found" }, { status: 404 })
    }

    const role = user.profile.role

    if (role === UserRole.Consultor) {
      if (simulation.userId !== dbUserId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else if (role === UserRole.Supervisor) {
      const supervisor = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, name: true, teamId: true },
      })

      let supervisorTeamId = supervisor?.teamId ?? null

      if (!supervisorTeamId && supervisor?.name) {
        const fallbackTeam = await prisma.team.findFirst({ where: { name: `Equipe ${supervisor.name}` } })
        if (fallbackTeam) {
          supervisorTeamId = fallbackTeam.id
          await prisma.user.update({ where: { id: supervisor.id }, data: { teamId: supervisorTeamId } })
        }
      }

      const teamId = simulation.user?.teamId ?? null
      if (!teamId || !supervisorTeamId || teamId !== supervisorTeamId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    } else {
    }

    const inputs = (simulation.inputs ?? {}) as any
  
    const cliente: string | null =
      typeof inputs.nomeCliente === "string" && inputs.nomeCliente.trim()
        ? inputs.nomeCliente.trim()
        : typeof inputs.clienteNome === "string" && inputs.clienteNome.trim()
          ? inputs.clienteNome.trim()
          : null

    const consultor: string | null =
      typeof inputs.nomeConsultor === "string" && inputs.nomeConsultor.trim()
        ? inputs.nomeConsultor.trim()
        : simulation.user?.name ?? null

    const tipoBem: string | null =
      typeof inputs.tipoBem === "string" && inputs.tipoBem.trim()
        ? inputs.tipoBem.trim()
        : null
        
  } catch (err: any) {
    console.error("POST /api/simulations/pdf failed", err)
    return NextResponse.json(
      {
        message: "Failed to generate PDF",
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
