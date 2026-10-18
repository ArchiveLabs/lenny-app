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
const replace = jest.fn()
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: jest.fn() }) }))
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
    expect(screen.getAllByText("Make super user")).toHaveLength(1)
    expect(screen.queryByText("Remove super access")).toBeNull()
    expect(screen.queryByText("Step down")).toBeNull()
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

  it("shows the new person's password once after adding, and not again", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "POST" ? ok(person({ id: 3, username: "bob", name: "Bob Jones", display_name: "Bob Jones", is_super: false })) : ok(path === "me" ? me : { librarians: [me] }))
    renderPage()
    await screen.findByText("Team")
    fireEvent.click(screen.getByText("Add a person"))
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "Bob Jones" } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "bob@b.test" } })
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "correct-horse-9!" } })
    fireEvent.click(screen.getByText("Add"))
    expect(await screen.findByText("Bob Jones was added")).toBeTruthy()
    expect(screen.getByText("correct-horse-9!")).toBeTruthy()
    fireEvent.click(screen.getByText("Done"))
    await waitFor(() => expect(screen.queryByText("correct-horse-9!")).toBeNull())
  })

  it("shows the name, with the username beside the email", async () => {
    const me = person({})
    serve(me, [me, person({ id: 2, username: "ann", name: "Ann Lee", display_name: "Ann Lee", is_super: false })])
    renderPage()
    expect(await screen.findByText("Ann Lee")).toBeTruthy()
    expect(screen.getByText(/ann · a@a.test/)).toBeTruthy()
  })

  it("has no actions on any super row, and no promote on a disabled account", async () => {
    const me = person({})
    serve(me, [me, person({ id: 2, username: "old", is_super: true }), person({ id: 3, username: "off", is_super: false, disabled: true })])
    renderPage()
    await screen.findByText("off")
    expect(screen.queryByText("Remove super access")).toBeNull()
    expect(screen.queryByText("Make super user")).toBeNull()
    expect(screen.getAllByText("Enable")).toHaveLength(1)
    expect(screen.queryByText("Disable")).toBeNull()
  })

  it("leaves the team page after handing the role over", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "PUT"
        ? ok(person({ id: 2, username: "ann", is_super: true, transferred: true }))
        : ok(path === "me" ? me : { librarians: [me, person({ id: 2, username: "ann", is_super: false })] }))
    renderPage()
    await screen.findByText("ann")
    fireEvent.click(screen.getByText("Make super user"))
    expect(await screen.findByText(/You will become a normal member/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Confirm with your own password/), { target: { value: "my-password-1!" } })
    fireEvent.click(screen.getByText("Confirm"))
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"))
  })

  it("deletes only after your password, and not on super or your own row", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "POST" ? ok({ deleted: true }) : ok(path === "me" ? me : { librarians: [me, person({ id: 2, username: "ann", is_super: false })] }))
    renderPage()
    await screen.findByText("ann")
    expect(screen.getAllByText("Delete")).toHaveLength(1) // ann only
    fireEvent.click(screen.getByText("Delete"))
    expect(await screen.findByText("Delete ann?")).toBeTruthy()
    expect(screen.getByText(/cannot be undone/)).toBeTruthy()
    fireEvent.click(screen.getAllByText("Delete")[1]) // submit with no password
    expect(await screen.findByText("Enter your password.")).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Confirm with your own password/), { target: { value: "my-password-1!" } })
    fireEvent.click(screen.getAllByText("Delete")[1])
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("librarians/2/delete", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ current_password: "my-password-1!" }),
      })))
  })

  it("keeps a refused delete in the form", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "POST"
        ? Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ detail: "Invalid password." }) })
        : ok(path === "me" ? me : { librarians: [me, person({ id: 2, username: "ann", is_super: false })] }))
    jest.requireMock("@/lib/api-client").handleApiResponse.mockImplementation(async (res) => {
      if (!res.ok) throw new (require("@/types/api").ApiError)((await res.json()).detail, res.status)
      return res.json()
    })
    renderPage()
    await screen.findByText("ann")
    fireEvent.click(screen.getByText("Delete"))
    fireEvent.change(await screen.findByLabelText(/Confirm with your own password/), { target: { value: "nope" } })
    fireEvent.click(screen.getAllByText("Delete")[1])
    expect(await screen.findByText("Invalid password.")).toBeTruthy()
    expect(screen.getByText("Delete ann?")).toBeTruthy()
  })
})
