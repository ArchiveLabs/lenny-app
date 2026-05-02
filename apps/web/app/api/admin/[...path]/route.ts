import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const internalApiUrl = process.env.LENNY_INTERNAL_API_URL // e.g. http://127.0.0.1:1337/v1/api
const internalSecret = process.env.ADMIN_INTERNAL_SECRET

async function proxyRequest(request: Request, context: { params: Promise<{ path: string[] }> }) {
    const { path: pathArray } = await context.params
    const joinedPath = pathArray.join("/")

    const url = new URL(request.url)
    const searchParams = url.searchParams.toString()
    const targetUrl = `${internalApiUrl}/admin/${joinedPath}${searchParams ? `?${searchParams}` : ""}`

    const cookieStore = await cookies()
    const token = cookieStore.get("admin_token")?.value

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${token ?? ""}`,
    }
    if (internalSecret) {
        headers["X-Admin-Internal-Secret"] = internalSecret
    }

    let body: BodyInit | null = null
    if (request.method !== "GET" && request.method !== "HEAD") {
        const text = await request.text()
        if (text) {
            body = text
            headers["Content-Type"] = request.headers.get("Content-Type") || "application/json"
        }
    }

    const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
    })

    const responseBody = await upstream.text()
    return new NextResponse(responseBody, {
        status: upstream.status,
        headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        },
    })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const DELETE = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
