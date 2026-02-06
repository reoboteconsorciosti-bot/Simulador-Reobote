import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ uid: string }> } // Next.js 15+ params are promises? Or standard. Assuming standard dynamic route.
) {
    // In Next.js 15, params is a Promise. In 14 it's just an object.
    // We'll await it to be safe or just access if we are on 14/15 compat.
    // Safe way:
    const ids = await params
    const uid = ids.uid

    if (!uid) {
        return new NextResponse("User ID required", { status: 400 })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: uid },
            select: { photoUrl: true },
        })

        if (!user || !user.photoUrl) {
            // Return 404 or a default image? 404 is better, let frontend handle fallback.
            return new NextResponse("Photo not found", { status: 404 })
        }

        // user.photoUrl is likely "data:image/png;base64,....."
        const matches = user.photoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)

        if (!matches || matches.length !== 3) {
            // If it's not a data URI (maybe a legacy http url?), redirect to it?
            if (user.photoUrl.startsWith("http")) {
                return NextResponse.redirect(user.photoUrl)
            }
            return new NextResponse("Invalid photo format", { status: 500 })
        }

        const contentType = matches[1]
        const buffer = Buffer.from(matches[2], "base64")

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600, must-revalidate", // 1 hour cache
            },
        })
    } catch (error) {
        console.error("Error fetching user photo:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
