// The admin session cookie, set the same way wherever a new token is issued.
export const SESSION_COOKIE = "admin_token"

export const sessionCookieOptions = {
    httpOnly: true, // not readable by JS
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
}
