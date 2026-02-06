import { prisma } from "@/lib/prisma"

const RATE_LIMIT_WINDOW_MS = 5000 // 5 seconds
const DAILY_QUOTA_LIMIT = 30

export type RateLimitResult = {
    success: boolean
    error?: "RATE_LIMIT" | "QUOTA_EXCEEDED"
    remaining?: number
}

export async function checkRateLimitAndQuota(userId: string): Promise<RateLimitResult> {
    const now = new Date()

    // 1. Check Frequency (Rate Limit) -> Last request < 5s ago
    const lastLog = await prisma.pdfGenerationLog.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
    })

    if (lastLog) {
        const timeDiff = now.getTime() - lastLog.createdAt.getTime()
        if (timeDiff < RATE_LIMIT_WINDOW_MS) {
            return { success: false, error: "RATE_LIMIT" }
        }
    }

    // 2. Check Daily Quota -> Count logs since start of day
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const dailyCount = await prisma.pdfGenerationLog.count({
        where: {
            userId,
            createdAt: { gte: startOfDay },
        },
    })

    if (dailyCount >= DAILY_QUOTA_LIMIT) {
        return { success: false, error: "QUOTA_EXCEEDED" }
    }

    return { success: true, remaining: DAILY_QUOTA_LIMIT - dailyCount }
}

export async function logPdfGeneration(userId: string, type: "STANDARD" | "CONSTRUCTION") {
    try {
        await prisma.pdfGenerationLog.create({
            data: {
                userId,
                type,
            },
        })
    } catch (error) {
        console.error("Failed to log PDF generation:", error)
        // Non-blocking error logging
    }
}
