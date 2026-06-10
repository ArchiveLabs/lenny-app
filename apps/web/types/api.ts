import { z } from "zod"

export const LennyRecordSchema = z.object({
  id: z.number(),
  openlibrary_edition: z.number(),
  encrypted: z.boolean(),
  formats: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  is_borrowable: z.boolean(),
  is_readable: z.boolean(),
  is_lendable: z.boolean(),
  available_copies: z.number()
})
export type LennyRecord = z.infer<typeof LennyRecordSchema>

export const LennyBookSchema = z.object({
  olid: z.string(),
  title: z.string(),
  author_name: z.array(z.string()),
  cover_i: z.number().optional(),
  lenny: LennyRecordSchema
})
export type LennyBook = z.infer<typeof LennyBookSchema>

export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  status: z.number().optional()
})
export class ApiError extends Error {
  status?: number
  code?: string
  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export const OLStatusSchema = z.object({
  logged_in: z.boolean(),
  username: z.string().nullish(),
  email: z.string().nullish(),
  s3_key_status: z.string().nullish(),
  last_auth: z.string().nullish(),
  lending_mode: z.string().nullish()
})
export type OLStatus = z.infer<typeof OLStatusSchema>

export const LendingModeSchema = z.enum(["none", "ol", "external"])
export type LendingMode = z.infer<typeof LendingModeSchema>

export const ExternalAuthConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  is_configured: z.boolean().optional().default(false),
  is_ready: z.boolean().optional().default(false),
  client_id: z.string().optional(),
  client_secret_set: z.boolean().optional(),
  discovery_url: z.string().optional(),
  redirect_uri: z.string().optional(),
  scopes: z.union([z.array(z.string()), z.string()]).optional(),
  flow: z.literal("pkce").optional()
})
export type ExternalAuthConfig = z.infer<typeof ExternalAuthConfigSchema>

export const AuthModeConfigSchema = z.object({
  lending_mode: LendingModeSchema,
  ol_ready: z.boolean(),
  external_auth_ready: z.boolean(),
  ia_auth_enabled: z.boolean().optional()
})
export type AuthModeConfig = z.infer<typeof AuthModeConfigSchema>

export const AdminLoanSchema = z.object({
  id: z.number(),
  user_identifier: z.string().nullable().optional(),
  book_title: z.string().nullable().optional(),
  edition_key: z.string().nullable().optional(),
  borrowed_at: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  returned_at: z.string().optional().nullable(),
  status: z.enum(["active", "returned", "overdue"])
})
export type AdminLoan = z.infer<typeof AdminLoanSchema>

export const HealthStatusSchema = z.object({
  status: z.string(),
  uptime_seconds: z.number(),
  database: z.string(),
  redis: z.string(),
  version: z.string()
})
export type HealthStatus = z.infer<typeof HealthStatusSchema>

export const LoanLimitsConfigSchema = z.object({
  max_concurrent_loans: z.number(),
  max_loan_duration_days: z.number(),
  max_renewals: z.number(),
  renewal_duration_days: z.number()
})
export type LoanLimitsConfig = z.infer<typeof LoanLimitsConfigSchema>

export const ProvidersConfigSchema = z.object({
  sirsi_enabled: z.boolean(),
  sirsi_base_url: z.string(),
  sirsi_client_id: z.string(),
  briet_enabled: z.boolean(),
  briet_endpoint: z.string(),
  briet_api_key: z.string()
})
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>

export const PaginatedAdminLoansSchema = z.object({
  items: z.array(AdminLoanSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number()
})
export type PaginatedAdminLoans = z.infer<typeof PaginatedAdminLoansSchema>
