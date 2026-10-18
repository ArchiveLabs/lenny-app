/** @jest-environment node */
import { SESSION_COOKIE, clearSession, sessionCookieOptions, userCookieOptions } from "./admin-session"

it("scopes the session cookie to the admin, httpOnly, same-site strict and for the token's 24 hours", () => {
  expect(sessionCookieOptions).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/admin", maxAge: 86400 })
  expect(userCookieOptions).toMatchObject({ httpOnly: false, sameSite: "strict", path: "/admin" })
})

it("clears both cookies on the current path and the old root path", () => {
  const res = { headers: new Headers() }
  clearSession(res)
  const set = res.headers.getSetCookie()
  expect(set).toHaveLength(4)
  for (const name of ["admin_token", "admin_user"]) for (const path of ["/", "/admin"])
    expect(set).toContainEqual(expect.stringMatching(new RegExp(`^${name}=; Path=${path}; Max-Age=0`)))
  expect(set.find((c) => c.startsWith("admin_token"))).toMatch(/HttpOnly/)
  expect(SESSION_COOKIE).toBe("admin_token")
})
