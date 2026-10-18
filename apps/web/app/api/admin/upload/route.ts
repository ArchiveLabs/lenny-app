import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { isSameOrigin } from "@/lib/admin-guard"

const internalApiUrl = process.env.LENNY_INTERNAL_API_URL // e.g. http://lenny_api:1337/v1/api
const internalSecret = process.env.ADMIN_INTERNAL_SECRET
const NO_STORE = { "Cache-Control": "no-store" }
// Same ceiling as the body limit in next.config.mjs and Lenny's MAX_FILE_SIZE. Lenny enforces it too;
// refusing early means an oversized upload is never streamed through this server.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
const UPLOAD_TIMEOUT_MS = 10 * 60_000

// /v1/api/upload is not under the /admin namespace (it's IP-allowlist gated,
// not bearer-token gated) so it can't go through the generic [...path] proxy,
// which always targets `${internalApiUrl}/admin/...`.
export async function POST(request: Request) {
    if (!internalApiUrl) {
        return NextResponse.json({ detail: "Admin API is not configured" }, { status: 500, headers: NO_STORE })
    }
    if (!isSameOrigin(request)) {
        return NextResponse.json({ detail: "Cross-origin request blocked" }, { status: 403, headers: NO_STORE })
    }
    const contentType = request.headers.get("Content-Type") || ""
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
        return NextResponse.json({ detail: "Send the file as multipart/form-data" }, { status: 415, headers: NO_STORE })
    }
    const length = Number(request.headers.get("Content-Length"))
    if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ detail: "That file is too large" }, { status: 413, headers: NO_STORE })
    }
    const targetUrl = `${internalApiUrl}/upload`

    const cookieStore = await cookies()
    const token = cookieStore.get("admin_token")?.value

    if (!token) {
        return NextResponse.json({ detail: "Unauthorized" }, { status: 401, headers: NO_STORE })
    }

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
    }
    if (internalSecret) {
        headers["X-Admin-Internal-Secret"] = internalSecret
    }

    headers["Content-Type"] = contentType

    let upstream: Response
    try {
        upstream = await fetch(targetUrl, {
            method: "POST",
            headers,
            body: request.body,
            redirect: "manual",
            signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
            // @ts-ignore - Required for Node.js fetch with stream body
            duplex: "half",
        })
    } catch (error) {
        console.error("Upload proxy could not reach Lenny:", error instanceof Error ? error.name : "error")
        return NextResponse.json({ detail: "Lenny is unreachable" }, { status: 502, headers: NO_STORE })
    }

    if (upstream.status >= 300 && upstream.status < 400) {
        return NextResponse.json({ detail: "Unexpected upstream redirect" }, { status: 502, headers: NO_STORE })
    }

    const responseBody = await upstream.text()

    return new NextResponse(responseBody, {
        status: upstream.status,
        headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
            "Cache-Control": "no-store",
        },
    })
}
