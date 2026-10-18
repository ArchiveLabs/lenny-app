// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { NavUser } from "./nav-user"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@blobatar/react", () => ({ Blobatar: () => <svg data-testid="blobatar" /> }))
let me
jest.mock("@/hooks/use-accounts", () => ({ useMe: () => ({ data: me }) }))

const show = () => render(<SidebarProvider><NavUser /></SidebarProvider>)

beforeEach(() => {
  me = undefined
  document.cookie = "admin_user=admin; path=/"
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
})

it("shows who is signed in, with an avatar and the role", async () => {
  show()
  expect(await screen.findByText("admin")).toBeInTheDocument()
  expect(screen.getByTestId("blobatar")).toBeInTheDocument()
  expect(screen.getByText("Administrator")).toBeInTheDocument()
})

it("shows the server's name and role once /admin/me answers", () => {
  me = { id: 7, username: "ann", display_name: "Ann Lee", is_super: true }
  show()
  expect(screen.getByText("Ann Lee")).toBeInTheDocument()
  expect(screen.getByText("Super user")).toBeInTheDocument()
})

it("falls back to Admin when the name is not known", () => {
  document.cookie = "admin_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  show()
  expect(screen.getByText("Admin")).toBeInTheDocument()
})

it("puts the way out in the same row as the name, as an icon with a label", () => {
  show()
  const logout = screen.getByRole("button", { name: "Log out" })
  expect(logout).toHaveAttribute("title", "Log out")
  expect(logout.parentElement).toContainElement(screen.getByText("Administrator"))
  expect(screen.queryByText("Log out")).not.toBeInTheDocument() // no big red button with a word on it
})

it("logs out through the server and goes to the login page", async () => {
  Object.defineProperty(window, "location", { value: { href: "" }, writable: true })
  show()
  fireEvent.click(screen.getByRole("button", { name: "Log out" }))
  await waitFor(() => expect(window.location.href).toBe("/admin/login"))
  expect(global.fetch).toHaveBeenCalledWith("/admin/api/auth/logout", { method: "POST" })
})
