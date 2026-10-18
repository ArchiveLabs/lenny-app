import { z } from "zod"

// All user-facing naming for the account screens lives here so it can be changed in one edit.
export const MIN_PASSWORD = 12

export const ACCOUNT = {
  route: "/account",
  title: "My account",
  description: "Your sign-in details.",
  profileTitle: "Profile",
  joined: (date: string) => `Joined ${date}`,
  roleSuperHelp: "You can manage the team and everything in this admin.",
  roleLibrarianHelp: "You can use this admin. Only a super user can manage the team.",
  manageTeam: "Manage team",
  emailTitle: "Email",
  emailHelp: "The email on your admin account.",
  emailLabel: "Email",
  emailSaved: "Email saved.",
  passwordTitle: "Change password",
  passwordHelp: `At least ${MIN_PASSWORD} characters.`,
  lengthSoFar: (n: number) => `${n} of ${MIN_PASSWORD} characters`,
  longEnough: "Long enough.",
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
  username: "Username",
  usernameHint: "They use this to sign in.",
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
  demote: "Remove super user",
  you: "You",
  noEmail: "No email",
  disableTitle: (name: string) => `Disable ${name}?`,
  disableBody: "They are signed out at once and can't sign in until you enable them again.",
  disabled: (name: string) => `${name} is disabled.`,
  enabled: (name: string) => `${name} is enabled.`,
  promoted: (name: string) => `${name} is now a super user.`,
  demoted: (name: string) => `${name} is no longer a super user.`,
} as const

export const EmailSchema = z.string().trim().min(1, "Enter an email address.").email("Enter a valid email address.")
export const NewPasswordSchema = z.string().min(MIN_PASSWORD, ACCOUNT.passwordShort)

export const ChangePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: NewPasswordSchema,
    again: z.string(),
  })
  .refine((v) => v.next === v.again, { path: ["again"], message: ACCOUNT.passwordMismatch })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a password you haven't used here before." })

export const NewPersonSchema = z.object({
  username: z.string().trim().min(1, "Enter a username."),
  email: EmailSchema,
  password: NewPasswordSchema,
})

/** The first problem for each field, keyed by field name, for showing under the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of error.issues) out[String(i.path[0] ?? "")] ??= i.message
  return out
}
