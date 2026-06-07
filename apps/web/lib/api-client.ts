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
  const secret = process.env.ADMIN_INTERNAL_SECRET || ""
  
  const headers = new Headers(options.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (secret) headers.set("X-Admin-Internal-Secret", secret)

  const baseUrl = process.env.LENNY_INTERNAL_API_URL || getApiBase()
  const targetUrl = `${baseUrl}/admin/${cleanPath}`

  return fetch(targetUrl, {
    ...options,
    headers,
  })
}

import { z } from "zod"

export async function handleApiResponse<T>(response: Response, schema?: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    let errorMsg = "Unknown error"
    try {
      const data = await response.json()
      errorMsg = data.message || data.error || data.detail || response.statusText
    } catch {
      errorMsg = await response.text().catch(() => response.statusText)
    }
    const error = new ApiError(errorMsg, response.status)
    throw error
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
