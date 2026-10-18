import { z } from "zod"

// All user-facing naming for the account screens lives here so it can be changed in one edit.
export const MIN_PASSWORD = 12

/** What to show for a person: their name, else their username. */
export const displayName = (p: { username: string; name?: string | null; display_name?: string }) =>
  p.display_name || p.name || p.username

export const ACCOUNT = {
  route: "/account",
  title: "My account",
  description: "Your sign-in details.",
  profileTitle: "Profile",
  nameTitle: "Name",
  nameLabel: "Name",
  nameSaved: "Name saved.",
  usernameLine: (u: string) => `Username: ${u}`,
  joined: (date: string) => `Joined ${date}`,
  roleSuperHelp: "You can manage the team and everything in this admin.",
  roleLibrarianHelp: "You can use this admin. Only a super user can manage the team.",
  manageTeam: "Manage team",
  emailTitle: "Email",
  emailHelp: "The email on your admin account.",
  emailLabel: "Email",
  emailSaved: "Email saved.",
  passwordTitle: "Change password",
  passwordHelp: `At least ${MIN_PASSWORD} characters, with a letter, a number and a symbol.`,
  matches: "The passwords match.",
  show: "Show password",
  hide: "Hide password",
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Repeat new password",
  passwordSaved: "Password changed.",
  passwordShort: `Use at least ${MIN_PASSWORD} characters.`,
  passwordMismatch: "The two new passwords don't match.",
  save: "Save",
  roleSuper: "Super user",
  roleLibrarian: "Librarian",
  promptTitle: "Add your email",
  promptBody: "Your account has no email yet. Add the one you want on it.",
  promptLater: "Later",
} as const

export const TEAM = {
  route: "/team",
  title: "Team",
  description: "People who can sign in to this admin.",
  add: "Add a person",
  addDescription: "They can sign in right away with this password.",
  name: "Name",
  username: "Username",
  signIn: "They can sign in with their email or this username.",
  email: "Email",
  password: "Password",
  create: "Add",
  added: (name: string) => `${name} was added.`,
  empty: "No one else yet.",
  loadFailed: "Couldn't load the team.",
  disabledBadge: "Disabled",
  disable: "Disable",
  enable: "Enable",
  promote: "Make super user",
  demote: "Remove super access",
  you: "You",
  promoteTitle: (name: string) => `Make ${name} a super user?`,
  demoteTitle: (name: string) => `Remove super access from ${name}?`,
  promoteBody: "A super user can add and disable people and change who else is a super user.",
  demoteBody: "They keep their account but can no longer manage the team.",
  confirmPassword: "Confirm with your own password",
  confirmPasswordHelp: "This is the password you sign in with, not theirs.",
  confirm: "Confirm",
  generate: "Generate",
  generated: "Shown only now. Pass it to the new person: Lenny keeps only a scrambled copy and can't show it again.",
  copy: "Copy",
  copied: "Copied",
  copyBlocked: "Couldn't copy",
  sharedTitle: (name: string) => `${name} was added`,
  sharedBody: "Share the password with them now. It is shown only this once.",
  done: "Done",
  noEmail: "No email",
  disableTitle: (name: string) => `Disable ${name}?`,
  disableBody: "They are signed out at once and can't sign in until you enable them again.",
  disabled: (name: string) => `${name} is disabled.`,
  enabled: (name: string) => `${name} is enabled.`,
  promoted: (name: string) => `${name} is now a super user.`,
  demoted: (name: string) => `${name} is no longer a super user.`,
} as const

export const EmailSchema = z.string().trim().min(1, "Enter an email address.").email("Enter a valid email address.")
// The server only checks the length; the rest is this app's rule for new passwords.
export const PASSWORD_RULES = [
  { key: "length", label: `At least ${MIN_PASSWORD} characters`, error: ACCOUNT.passwordShort, ok: (p: string) => p.length >= MIN_PASSWORD },
  { key: "letter", label: "A letter", error: "Add a letter.", ok: (p: string) => /\p{L}/u.test(p) },
  { key: "number", label: "A number", error: "Add a number.", ok: (p: string) => /\d/.test(p) },
  { key: "symbol", label: "A symbol, like ! or #", error: "Add a symbol, like ! or #.", ok: (p: string) => /[^\p{L}\d\s]/u.test(p) },
] as const

export const NewPasswordSchema = z.string().superRefine((p, ctx) => {
  const broken = PASSWORD_RULES.find((r) => !r.ok(p))
  if (broken) ctx.addIssue({ code: "custom", message: broken.error })
})

export const ChangePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: NewPasswordSchema,
    again: z.string(),
  })
  .refine((v) => v.next === v.again, { path: ["again"], message: ACCOUNT.passwordMismatch })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a password you haven't used here before." })

export const NameSchema = z.string().trim().min(1, "Enter a name.").max(100, "Use 100 characters or fewer.")

export const NewPersonSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: NewPasswordSchema,
})

/** The first problem for each field, keyed by field name, for showing under the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of error.issues) out[String(i.path[0] ?? "")] ??= i.message
  return out
}

// No look-alikes: no 0/O, 1/l/I.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz"
const DIGITS = "23456789"
const SYMBOLS = "!#$%*+-=?@"

/** Unbiased random integer below `max` (rejection sampling), from the browser's secure generator. */
function randomBelow(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0]! >= limit)
  return buf[0]! % max
}

/** A random password with at least one letter, digit and symbol, shuffled so the kinds aren't in fixed places. */
export function generatePassword(length = 20): string {
  const all = LETTERS + DIGITS + SYMBOLS
  const pick = (set: string) => set[randomBelow(set.length)]!
  const chars = [pick(LETTERS), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join("")
}
