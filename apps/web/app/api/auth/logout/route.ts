import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { isSameOrigin } from "@/lib/admin-guard"
import { SESSION_COOKIE, clearSession } from "@/lib/admin-session"

/** Asks Lenny to end this person's sessions on every device. Best effort: the caller clears the cookies either way. */
async function revokeUpstream(token: string): Promise<void> {
    const base = process.env.LENNY_INTERNAL_API_URL
    const secret = process.env.ADMIN_INTERNAL_SECRET
    if (!base || !secret) return // dev with no backend: nothing to revoke
    try {
        await fetch(`${base}/admin/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "X-Admin-Internal-Secret": secret },
            redirect: "manual",
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
        })
    } catch (error) {
        console.error("Logout could not reach Lenny to end the session:", error instanceof Error ? error.name : "error")
    }
}

export async function POST(request: Request) {
    // Another site must not be able to sign you out.
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403, headers: { "Cache-Control": "no-store" } })
    }
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    if (token) await revokeUpstream(token)

    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
    clearSession(response)
    return response
}
