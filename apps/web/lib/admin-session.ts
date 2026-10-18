// The admin session cookies, set and cleared the same way wherever they change.
export const SESSION_COOKIE = "admin_token"
export const USER_COOKIE = "admin_user"

// Scoped to the admin so the token is never sent to the public Lenny API or anything else on the host.
const COOKIE_PATH = "/admin"

const base = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: COOKIE_PATH,
    maxAge: 60 * 60 * 24,
}

export const sessionCookieOptions = { ...base, httpOnly: true } // not readable by JS
export const userCookieOptions = { ...base, httpOnly: false } // display only

const expired = (name: string, path: string, httpOnly: boolean) =>
    `${name}=; Path=${path}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict${httpOnly ? "; HttpOnly" : ""}${base.secure ? "; Secure" : ""}`

const LEGACY_PATH = "/" // earlier versions scoped the cookies here

/**
 * Drops cookies left over from before the /admin scope. Without this, a browser that signed in
 * before the upgrade would keep a second, broader admin_token next to the new one.
 * Written as raw Set-Cookie headers: a cookie jar is keyed by name, so it can't hold both paths.
 */
export function clearLegacySession(response: { headers: Headers }) {
    response.headers.append("Set-Cookie", expired(SESSION_COOKIE, LEGACY_PATH, true))
    response.headers.append("Set-Cookie", expired(USER_COOKIE, LEGACY_PATH, false))
}

/** Ends the session in the browser, on the current path and the legacy one. */
export function clearSession(response: { headers: Headers }) {
    clearLegacySession(response)
    response.headers.append("Set-Cookie", expired(SESSION_COOKIE, COOKIE_PATH, true))
    response.headers.append("Set-Cookie", expired(USER_COOKIE, COOKIE_PATH, false))
}
