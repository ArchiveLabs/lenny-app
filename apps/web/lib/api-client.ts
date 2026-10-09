import { ApiError } from "@/types/api"

export function getApiBase(): string {
  const envApi = process.env.NEXT_PUBLIC_API_URL
  if (envApi) {
    const isInternalDockerHost = envApi.includes("lenny_api")
    if (!isInternalDockerHost) return envApi
  }
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location
    if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:8080"
    return origin
  }
  return "http://localhost:8080"
}

// getApiBase() can return a bare origin, an origin with a path (e.g. .../v1/api),
// or (client-side) a relative path — callers building a public URL for a
// server-pinned route need just the origin, not whatever path happens to be
// baked into NEXT_PUBLIC_API_URL.
export function apiOrigin(apiBase: string): string {
  try {
    return new URL(apiBase).origin
  } catch {
    return typeof window !== "undefined" ? window.location.origin : apiBase
  }
}

/**
 * Wrapper for calling admin endpoints.
 * Routes through the Next.js API proxy (/admin/api/admin) so auth headers are injected.
 */
export async function fetchAdmin(path: string, options: RequestInit = {}): Promise<Response> {
  const isBrowser = typeof window !== "undefined"
  const cleanPath = path.replace(/^\/+/, "")
  
  // From the browser, hit the Next.js proxy route to inject headers.
  // basePath ('/admin') is not prepended by fetch() automatically — include it explicitly.
  if (isBrowser) {
    const url = `/admin/api/admin/${cleanPath}`
    return fetch(url, options)
  }

  // Server-side (RSC / Middleware) must call the backend directly and inject headers
  const token = "" // TODO: Server-side token retrieval if needed
  const internalUrl = process.env.LENNY_INTERNAL_API_URL
  // Only ever send the internal secret to the configured internal URL, never to the public one.
  const secret = internalUrl ? process.env.ADMIN_INTERNAL_SECRET || "" : ""
  
  const headers = new Headers(options.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (secret) headers.set("X-Admin-Internal-Secret", secret)

  const baseUrl = internalUrl || getApiBase()
  const targetUrl = `${baseUrl}/admin/${cleanPath}`

  return fetch(targetUrl, {
    ...options,
    headers,
  })
}

import { z } from "zod"

// Short, human wording for failures that carry no usable `detail` (HTML error pages, empty bodies).
function friendlyStatus(status: number, statusText: string): string {
  if (status === 401) return "Your session has expired. Sign in again."
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return "Not found."
  if (status >= 500) return "The server had a problem. Try again in a moment."
  return statusText || "Something went wrong."
}

let redirectingToLogin = false

/** Expired or invalid admin session: clear the stale cookie (so /login doesn't bounce back) and go to the login page. */
export async function redirectToLogin(): Promise<void> {
  if (redirectingToLogin || typeof window === "undefined") return
  redirectingToLogin = true
  try {
    await fetch("/admin/api/auth/logout", { method: "POST" })
  } catch {
    // still navigate; the login page works either way
  }
  const next = window.location.pathname.replace(/^\/admin/, "") + window.location.search
  window.location.assign(`/admin/login?next=${encodeURIComponent(next)}`)
}

export async function handleApiResponse<T>(response: Response, schema?: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    let errorMsg = ""
    try {
      const data = await response.json()
      // FastAPI validation errors put an array of {msg} objects in `detail`.
      const detail = Array.isArray(data.detail)
        ? data.detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join("; ")
        : data.detail
      errorMsg = data.message || data.error || (typeof detail === "string" && detail) || ""
    } catch {
      // not JSON (e.g. a proxy's HTML error page): never show that body to the admin
    }
    throw new ApiError(errorMsg || friendlyStatus(response.status, response.statusText), response.status)
  }

  // If no content, just return empty object
  if (response.status === 204) {
    if (schema) {
      const result = schema.safeParse({})
      if (!result.success) {
        throw new ApiError(`Invalid API response format: ${result.error.message}`, response.status)
      }
      return result.data
    }
    return {} as T
  }
  
  const json = await response.json()
  if (schema) {
    const result = schema.safeParse(json)
    if (!result.success) {
      console.error("API response validation failed:", result.error)
      throw new ApiError(`Invalid API response format: ${result.error.message}`, response.status)
    }
    return result.data
  }
  return json as T
}
