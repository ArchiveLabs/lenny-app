import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
    // Dev bypass — skip auth entirely
    if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "true") {
        return NextResponse.next()
    }

    const { pathname } = request.nextUrl

    // Allow the login page and auth API routes through
    // Note: with basePath, middleware sees paths WITHOUT the prefix
    if (pathname === "/login" || pathname.startsWith("/api/auth")) {
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

    // Check for admin token cookie
    const token = request.cookies.get("admin_token")?.value

    if (!token) {
        // Redirect to login — use nextUrl to preserve basePath
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = "/login"
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!_next/static|_next/image).*)"],
}
