// @ts-nocheck
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import TeamPage from "./page"
import { fetchAdmin } from "@/lib/api-client"

jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  redirectToLogin: jest.fn(),
  handleApiResponse: jest.fn((res) => res.json()),
}))
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@blobatar/react", () => ({ Blobatar: () => null }))

const person = (o) => ({ id: 1, username: "admin", email: "a@a.test", is_super: true, disabled: false, created_at: "", ...o })
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const serve = (me, librarians = [me]) =>
  fetchAdmin.mockImplementation((path) => ok(path === "me" ? me : { librarians }))
const renderPage = () => render(<QueryClientProvider client={new QueryClient()}><TeamPage /></QueryClientProvider>)

describe("TeamPage", () => {
  beforeEach(() => jest.clearAllMocks())

  it("lists the team for a super user and asks before disabling", async () => {
    const me = person({})
    serve(me, [me, person({ id: 2, username: "ann", is_super: false })])
    renderPage()
    expect(await screen.findByText("ann")).toBeTruthy()
    expect(screen.getAllByText("Disable")).toHaveLength(1) // not on your own row
    fireEvent.click(screen.getByText("Disable"))
    expect(await screen.findByText("Disable ann?")).toBeTruthy()
  })

  it("never asks for the team when the signed-in person is not a super user", async () => {
    serve(person({ is_super: false }))
    renderPage()
    expect(await screen.findByText("Only a super user can manage the team.")).toBeTruthy()
    await waitFor(() => expect(fetchAdmin).not.toHaveBeenCalledWith("librarians"))
  })

  it("asks for your own password before changing who is super, and sends it", async () => {
    const me = person({})
    serve(me, [me, person({ id: 2, username: "ann", is_super: false })])
    renderPage()
    await screen.findByText("ann")
    fireEvent.click(screen.getByText("Make super user"))
    expect(await screen.findByText("Make ann a super user?")).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Confirm with your own password/), { target: { value: "my-password-1!" } })
    fireEvent.click(screen.getByText("Confirm"))
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("librarians/2", expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ is_super: true, current_password: "my-password-1!" }),
      })))
  })

  it("keeps a wrong password in the form instead of closing", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "PUT"
        ? Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ detail: "The current password is wrong." }) })
        : ok(path === "me" ? me : { librarians: [me, person({ id: 2, username: "ann", is_super: false })] }))
    jest.requireMock("@/lib/api-client").handleApiResponse.mockImplementation(async (res) => {
      if (!res.ok) throw new (require("@/types/api").ApiError)((await res.json()).detail, res.status)
      return res.json()
    })
    renderPage()
    await screen.findByText("ann")
    fireEvent.click(screen.getByText("Make super user"))
    fireEvent.change(await screen.findByLabelText(/Confirm with your own password/), { target: { value: "nope" } })
    fireEvent.click(screen.getByText("Confirm"))
    expect(await screen.findByText("The current password is wrong.")).toBeTruthy()
    expect(screen.getByText("Make ann a super user?")).toBeTruthy()
  })
})
