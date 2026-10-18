import { NextResponse } from "next/server"
import { isSameOrigin } from "@/lib/admin-guard"
import { clearSession } from "@/lib/admin-session"

export async function POST(request: Request) {
    // Another site must not be able to sign you out.
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403, headers: { "Cache-Control": "no-store" } })
    }
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
    clearSession(response)
    return response
}
