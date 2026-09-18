import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const internalApiUrl = process.env.LENNY_INTERNAL_API_URL // e.g. http://lenny_api:1337/v1/api
const internalSecret = process.env.ADMIN_INTERNAL_SECRET

// /v1/api/upload is not under the /admin namespace (it's IP-allowlist gated,
// not bearer-token gated) so it can't go through the generic [...path] proxy,
// which always targets `${internalApiUrl}/admin/...`.
export async function POST(request: Request) {
    const targetUrl = `${internalApiUrl}/upload`

    const cookieStore = await cookies()
    const token = cookieStore.get("admin_token")?.value

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${token ?? ""}`,
    }
    if (internalSecret) {
        headers["X-Admin-Internal-Secret"] = internalSecret
    }

    const contentType = request.headers.get("Content-Type") || ""
    headers["Content-Type"] = contentType

    const upstream = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: request.body,
        // @ts-ignore - Required for Node.js fetch with stream body
        duplex: "half",
    })

    const responseBody = await upstream.text()

    return new NextResponse(responseBody, {
        status: upstream.status,
        headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        },
    })
}
