/** True for an absolute http(s) URL: the only kind that is safe to put in an href that comes from data. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/** Where to go after signing in: a path on this site, else "/". Never another origin. */
export function safeNextPath(next: string | undefined): string {
  return next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\") &&
    // browsers strip tabs/newlines inside URLs, so "/\t/evil.com" would become "//evil.com"
    !/[\u0000-\u001f]/.test(next)
    ? next
    : "/"
}
