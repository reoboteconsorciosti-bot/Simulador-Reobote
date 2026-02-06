import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1` // simple connectivity check
    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("DB health error", error)

    const isDev = process.env.NODE_ENV !== "production"
    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)

    return NextResponse.json(
      {
        status: "error",
        hasDatabaseUrl,
        ...(isDev
          ? {
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.name : undefined,
            }
          : null),
      },
      { status: 500 },
    )
  }
}
