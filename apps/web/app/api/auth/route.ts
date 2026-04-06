import { NextResponse } from "next/server"

export async function POST(request: Request) {
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

    if (internalApiUrl && internalSecret) {
        // Production: proxy to FastAPI on Docker internal network
        try {
            const res = await fetch(`${internalApiUrl}/admin/auth`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Internal-Secret": internalSecret,
                },
                body: JSON.stringify({ username, password }),
            })

            if (!res.ok) {
                const detail = await res.json().catch(() => ({}))
                return NextResponse.json(
                    { error: detail.detail || "Invalid credentials" },
                    { status: res.status }
                )
            }

            const data = await res.json()
            token = data.token
        } catch (error) {
            console.error("Failed to reach Lenny API for auth:", error)
            return NextResponse.json(
                { error: "Authentication service unavailable" },
                { status: 503 }
            )
        }
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

    // httpOnly auth token (not readable by JS)
    response.cookies.set("admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
    })

    // Non-httpOnly username cookie (readable by client for display purposes only)
    response.cookies.set("admin_user", username, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
    })

    return response
}
