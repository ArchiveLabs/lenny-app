import { ChangePasswordSchema, EmailSchema, NewPersonSchema, fieldErrors } from "./accounts"

const change = (v: object) => ChangePasswordSchema.safeParse({ current: "old-password-1", next: "new-password-12", again: "new-password-12", ...v })

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
  it("needs the repeat to match", () => expect(fieldErrors((change({ again: "other-password-12" }) as any).error)).toHaveProperty("again"))
  it("refuses the same password again", () => expect(fieldErrors((change({ next: "old-password-1x", current: "old-password-1x", again: "old-password-1x" }) as any).error)).toHaveProperty("next"))
})

describe("NewPersonSchema", () => {
  it("reports every bad field at once", () => {
    const r = NewPersonSchema.safeParse({ username: " ", email: "x", password: "short" })
    expect(Object.keys(fieldErrors((r as any).error)).sort()).toEqual(["email", "password", "username"])
  })
})
