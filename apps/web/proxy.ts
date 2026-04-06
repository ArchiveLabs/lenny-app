import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
    // Dev bypass — skip auth entirely (server-only env var, not exposed to client)
    if (process.env.AUTH_BYPASS === "true") {
        return NextResponse.next()
    }

    const { pathname } = request.nextUrl

    // Allow auth API routes through unconditionally
    if (pathname.startsWith("/api/auth")) {
        return NextResponse.next()
    }

    // Allow static assets & Next.js internals
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.endsWith(".png") ||
        pathname.endsWith(".ico") ||
        pathname.endsWith(".svg") ||
        pathname.endsWith(".json")
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
        // Redirect to login, preserving full path+query for post-login redirect
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = "/login"
        loginUrl.searchParams.set("next", pathname + request.nextUrl.search)
        return NextResponse.redirect(loginUrl)
    }

    // Prevent BFCache from caching authenticated pages — ensures logout takes effect immediately
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "no-store, must-revalidate")
    return response
}

export const proxyConfig = {
    matcher: ["/((?!_next/static|_next/image).*)"],
}
