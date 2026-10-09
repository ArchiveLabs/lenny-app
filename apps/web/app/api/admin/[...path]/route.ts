import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { hasUnsafeSegment, isSameOrigin } from "@/lib/admin-guard"

const internalApiUrl = process.env.LENNY_INTERNAL_API_URL // e.g. http://127.0.0.1:1337/v1/api
const internalSecret = process.env.ADMIN_INTERNAL_SECRET

async function proxyRequest(request: Request, context: { params: Promise<{ path: string[] }> }) {
    const { path: pathArray } = await context.params

    if (!internalApiUrl) {
        return NextResponse.json({ detail: "Admin API is not configured" }, { status: 500 })
    }
    // Segments arrive decoded: reject ".." / "%2e%2e" / encoded slashes before they can
    // walk out of /admin/ with the secret and token attached.
    if (hasUnsafeSegment(pathArray)) {
        return NextResponse.json({ detail: "Invalid path" }, { status: 400 })
    }
    if (request.method !== "GET" && request.method !== "HEAD" && !isSameOrigin(request)) {
        return NextResponse.json({ detail: "Cross-origin request blocked" }, { status: 403 })
    }
    const joinedPath = pathArray.map(encodeURIComponent).join("/")

    const url = new URL(request.url)
    const searchParams = url.searchParams.toString()
    const targetUrl = `${internalApiUrl}/admin/${joinedPath}${searchParams ? `?${searchParams}` : ""}`

    const cookieStore = await cookies()
    const token = cookieStore.get("admin_token")?.value
    // Never attach the internal secret to an anonymous request.
    if (!token) {
        return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
    }

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
    }
    if (internalSecret) {
        headers["X-Admin-Internal-Secret"] = internalSecret
    }

    let body: BodyInit | null | undefined = undefined
    if (request.method !== "GET" && request.method !== "HEAD") {
        const contentType = request.headers.get("Content-Type") || ""
        if (contentType.includes("multipart/form-data")) {
            // Pass the FormData natively so boundaries are preserved.
            // We do not set the Content-Type header manually here; 
            // fetch will automatically set it with the correct boundary when passing FormData.
            // Wait, since we are proxying, we can actually just pass the raw request.body
            // and keep the original Content-Type which already has the boundary!
            body = request.body
            headers["Content-Type"] = contentType
        } else {
            const text = await request.text()
            if (text) {
                body = text
                headers["Content-Type"] = contentType || "application/json"
            }
        }
    }

    const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        // The secret header would follow a redirect to another host; never follow.
        redirect: "manual",
        // @ts-ignore - Required for Node.js fetch with stream body
        duplex: "half",
    })

    if (upstream.status >= 300 && upstream.status < 400) {
        return NextResponse.json({ detail: "Unexpected upstream redirect" }, { status: 502 })
    }

    const responseBody = await upstream.text()

    // Null-body statuses (204/205/304) must not carry a body on the Response we
    // construct here - passing even an empty string throws inside this route handler
    // ("Response with null body status cannot have body"), which Next.js turns into a
    // 500 that looks like the delete itself failed, even though the upstream call
    // (e.g. DELETE /admin/items/{id}, which correctly returns 204) already succeeded.
    const isNullBodyStatus = upstream.status === 204 || upstream.status === 205 || upstream.status === 304

    return new NextResponse(isNullBodyStatus ? null : responseBody, {
        status: upstream.status,
        headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
            // Responses can carry one-time secrets; never let a cache keep them.
            "Cache-Control": "no-store",
        },
    })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const DELETE = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
