/** @jest-environment node */
// @ts-nocheck
import DashboardLayout from "./layout"

const mockCookie = jest.fn()
const mockRedirect = jest.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`) })
jest.mock("next/headers", () => ({ cookies: async () => ({ get: mockCookie }) }))
jest.mock("next/navigation", () => ({ redirect: (to: string) => mockRedirect(to) }))
jest.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }))
jest.mock("@/components/email-prompt", () => ({ EmailPrompt: () => null }))
jest.mock("@/components/site-header", () => ({ SiteHeader: () => null }))
jest.mock("@workspace/ui/components/sidebar", () => ({ SidebarProvider: () => null, SidebarInset: () => null }))

beforeEach(() => jest.clearAllMocks())

it("sends a signed-out visitor to /login, which Next serves under the /admin basePath", async () => {
  mockCookie.mockReturnValue(undefined)
  await expect(DashboardLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT /login")
  // redirect() prepends the basePath itself: "/admin/login" would land on /admin/admin/login (404).
  expect(mockRedirect).not.toHaveBeenCalledWith("/admin/login")
})

it("shows the dashboard when there is a session cookie", async () => {
  mockCookie.mockReturnValue({ value: "tok" })
  await expect(DashboardLayout({ children: null })).resolves.toBeTruthy()
  expect(mockRedirect).not.toHaveBeenCalled()
})
