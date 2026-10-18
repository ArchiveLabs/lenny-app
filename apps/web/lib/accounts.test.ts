import { ChangePasswordSchema, generatePassword, NewPasswordSchema, EmailSchema, NewPersonSchema, fieldErrors } from "./accounts"

const GOOD = "new-password-12!"
const change = (v: object) => ChangePasswordSchema.safeParse({ current: "old-password-1", next: GOOD, again: GOOD, ...v })

describe("EmailSchema", () => {
  it("trims and accepts an address", () => expect(EmailSchema.parse("  a@b.test ")).toBe("a@b.test"))
  it("rejects empty and malformed input", () => {
    expect(EmailSchema.safeParse("").success).toBe(false)
    expect(EmailSchema.safeParse("not-an-email").success).toBe(false)
  })
})

describe("ChangePasswordSchema", () => {
  it("accepts a good change", () => expect(change({}).success).toBe(true))
  it("needs the current password", () => expect(fieldErrors((change({ current: "" }) as any).error)).toHaveProperty("current"))
  it("needs 12 characters", () => expect(fieldErrors((change({ next: "short", again: "short" }) as any).error)).toHaveProperty("next"))
  it.each([["no letter", "123456789012!"], ["no number", "abcdefghijkl!"], ["no symbol", "abcdefghijkl1"]])("rejects a password with %s", (_, pw) =>
    expect(fieldErrors((change({ next: pw, again: pw }) as any).error)).toHaveProperty("next"))
  it("needs the repeat to match", () => expect(fieldErrors((change({ again: "other-password-12!" }) as any).error)).toHaveProperty("again"))
  it("refuses the same password again", () => expect(fieldErrors((change({ next: "old-password-1!", current: "old-password-1!", again: "old-password-1!" }) as any).error)).toHaveProperty("next"))
})

describe("NewPersonSchema", () => {
  it("reports every bad field at once", () => {
    const r = NewPersonSchema.safeParse({ username: " ", email: "x", password: "short" })
    expect(Object.keys(fieldErrors((r as any).error)).sort()).toEqual(["email", "password", "username"])
  })
})

describe("generatePassword", () => {
  beforeAll(() => { Object.defineProperty(globalThis, "crypto", { value: require("crypto").webcrypto, configurable: true }) })

  it("is 20 characters, passes the password rules and has no look-alikes", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword()
      expect(p).toHaveLength(20)
      expect(NewPasswordSchema.safeParse(p).success).toBe(true)
      expect(p).not.toMatch(/[0OIl1]/)
    }
  })
  it("differs every time", () => expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50))
})
