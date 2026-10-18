import { NextResponse } from "next/server"
import { isSameOrigin } from "@/lib/admin-guard"
import { SESSION_COOKIE, USER_COOKIE, sessionCookieOptions, userCookieOptions } from "@/lib/admin-session"

async function login(request: Request) {
    // Another site must not be able to sign you in as someone it controls.
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 })
    }
    let username: string | undefined
    let password: string | undefined

    try {
        const body = await request.json()
        username = body.username
        password = body.password
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!username || !password) {
        return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    // In production: call FastAPI internal endpoint
    const internalApiUrl = process.env.LENNY_INTERNAL_API_URL
    const internalSecret = process.env.ADMIN_INTERNAL_SECRET

    let token: string | null = null
    let signedInAs = username

    if (internalApiUrl && internalSecret) {
        // Production: proxy to FastAPI on Docker internal network
        try {
            const res = await fetch(`${internalApiUrl}/admin/auth`, {
                method: "POST",
                redirect: "manual",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Internal-Secret": internalSecret,
                },
                body: JSON.stringify({ username, password }),
            })

            if (res.status === 429) {
                return NextResponse.json({ error: "Too many attempts, try again in a few minutes." }, { status: 429 })
            }
            if (!res.ok) {
                const detail = await res.json().catch(() => ({}))
                return NextResponse.json(
                    { error: detail.detail || "Invalid credentials" },
                    { status: res.status }
                )
            }

            const data = await res.json()
            token = data.token
            // The server's spelling of the name, so the avatar and header match what /admin/me says.
            const shown = data.display_name || data.username
            if (typeof shown === "string" && shown) signedInAs = shown
        } catch (error) {
            console.error("Failed to reach Lenny API for auth:", error)
            return NextResponse.json(
                { error: "Authentication service unavailable" },
                { status: 503 }
            )
        }
    } else if (process.env.NODE_ENV === "production") {
        // Misconfigured production must fail closed, never fall back to default credentials.
        console.error("LENNY_INTERNAL_API_URL / ADMIN_INTERNAL_SECRET not set")
        return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 })
    } else {
        // Dev fallback: accept hardcoded credentials when no backend is available
        const devUsername = process.env.ADMIN_USERNAME || "admin"
        const devPassword = process.env.ADMIN_PASSWORD || "admin"
        if (username !== devUsername || password !== devPassword) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
        }
        token = "dev-token-" + Date.now()
    }

    if (!token) {
        return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions)

    // Readable by the page, for display only.
    response.cookies.set(USER_COOKIE, signedInAs, userCookieOptions)

    return response
}

// Every answer here is about one person's credentials or session: never cacheable.
export async function POST(request: Request) {
    const response = await login(request)
    response.headers.set("Cache-Control", "no-store")
    return response
}
