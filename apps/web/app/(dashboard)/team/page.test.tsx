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
    fireEvent.click(screen.getAllByText("Disable")[1])
    expect(await screen.findByText("Disable ann?")).toBeTruthy()
  })

  it("never asks for the team when the signed-in person is not a super user", async () => {
    serve(person({ is_super: false }))
    renderPage()
    expect(await screen.findByText("Only a super user can manage the team.")).toBeTruthy()
    await waitFor(() => expect(fetchAdmin).not.toHaveBeenCalledWith("librarians"))
  })
})
