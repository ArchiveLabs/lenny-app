import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { clearSession } from "@/lib/admin-session"

// A cookie that merely exists proves nothing: ask Lenny whether the token is still good, so a
// forged or ended session never gets the page shells. Only a 401 counts as "not signed in":
// if Lenny is down or misconfigured the page shows its own error and every API call fails anyway.
async function sessionEnded(token: string): Promise<boolean> {
    const base = process.env.LENNY_INTERNAL_API_URL
    const secret = process.env.ADMIN_INTERNAL_SECRET
    if (!base || !secret) return false // dev with no backend: there is nobody to ask
    try {
        const res = await fetch(`${base}/admin/verify`, {
            headers: { Authorization: `Bearer ${token}`, "X-Admin-Internal-Secret": secret },
            redirect: "manual",
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
        })
        return res.status === 401
    } catch {
        return false
    }
}

export async function proxy(request: NextRequest) {
    // Dev bypass — skip auth entirely (server-only env var, not exposed to client)
    if (process.env.AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production") {
        return NextResponse.next()
    }

    const { pathname } = request.nextUrl

    // Allow auth API routes through unconditionally
    if (pathname.startsWith("/api/auth")) {
        return NextResponse.next()
    }

    // Allow static assets & Next.js internals (never API routes: "/api/admin/x.json"
    // must not skip the session check)
    if (
        !pathname.startsWith("/api/") && (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.endsWith(".png") ||
        pathname.endsWith(".ico") ||
        pathname.endsWith(".svg") ||
        pathname.endsWith(".json"))
    ) {
        return NextResponse.next()
    }

    const token = request.cookies.get("admin_token")?.value

    if (pathname === "/login") {
        // Already authenticated — send to home
        if (token) {
            const homeUrl = request.nextUrl.clone()
            homeUrl.pathname = "/"
            return NextResponse.redirect(homeUrl)
        }
        return NextResponse.next()
    }

    if (!token) {
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        // Redirect to login, preserving full path+query for post-login redirect
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = "/login"
        loginUrl.searchParams.set("next", pathname + request.nextUrl.search)
        return NextResponse.redirect(loginUrl)
    }

    // Pages only: API routes carry the token upstream, where Lenny checks it on every call.
    if (!pathname.startsWith("/api/") && (await sessionEnded(token))) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = "/login"
        loginUrl.search = ""
        loginUrl.searchParams.set("next", pathname + request.nextUrl.search)
        const redirect = NextResponse.redirect(loginUrl)
        clearSession(redirect)
        return redirect
    }

    // Prevent BFCache from caching authenticated pages — ensures logout takes effect immediately
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "no-store, must-revalidate")
    return response
}

export const config = {
    matcher: ["/((?!_next/static|_next/image).*)"],
}
