// Shared guards for the routes that attach the admin secret + token to upstream calls.

// A path segment is unsafe if, once decoded by Next, it could change what the upstream URL
// means: dot segments (escape the /admin/ prefix), separators, or query/fragment delimiters.
const UNSAFE_SEGMENT = /^\.{1,2}$|[/\\?#\u0000-\u001f]/

export function hasUnsafeSegment(segments: string[]): boolean {
    return segments.some((s) => s === "" || UNSAFE_SEGMENT.test(s))
}

// CSRF defence in depth on top of the SameSite=strict cookie: a state-changing request must
// come from the host the admin app is served on. Compared by hostname (ports are ignored)
// because common reverse-proxy setups forward Host without the port (nginx `$host`).
const hostname = (hostHeader: string) => new URL(`http://${hostHeader}`).hostname

let warned = false

export function isSameOrigin(request: Request): boolean {
    if (request.headers.get("sec-fetch-site") === "cross-site") return false
    const origin = request.headers.get("origin")
    if (!origin) return true // non-browser caller, or a browser that sends no Origin
    // x-forwarded-host is whatever the client sent unless a trusted proxy overwrites it, so
    // set ADMIN_PUBLIC_HOST to the host the admin is served on and it is the only one trusted.
    if (!process.env.ADMIN_PUBLIC_HOST && process.env.NODE_ENV === "production" && !warned) {
        warned = true
        console.warn("ADMIN_PUBLIC_HOST is not set: the origin check trusts a client-supplied X-Forwarded-Host. Set it to the host the admin is served on.")
    }
    const host = process.env.ADMIN_PUBLIC_HOST || request.headers.get("x-forwarded-host") || request.headers.get("host")
    if (!host) return false
    try {
        return new URL(origin).hostname === hostname(host.split(",")[0]!.trim())
    } catch {
        return false
    }
}
