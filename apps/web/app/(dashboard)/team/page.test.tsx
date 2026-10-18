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

const ann = () => person({ id: 2, username: "ann", name: "Ann Lee", display_name: "Ann Lee", is_super: false })
const openMenu = (name) => fireEvent.keyDown(screen.getByLabelText(`Actions for ${name}`), { key: "Enter" })
const refuse = (detail) => {
  jest.requireMock("@/lib/api-client").handleApiResponse.mockImplementation(async (res) => {
    if (!res.ok) throw new (require("@/types/api").ApiError)((await res.json()).detail, res.status)
    return res.json()
  })
  return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ detail }) })
}

describe("TeamPage", () => {
  beforeEach(() => jest.clearAllMocks())

  it("keeps rows quiet: a menu only on other members, none on you or a super row", async () => {
    const me = person({})
    serve(me, [me, person({ id: 3, username: "old", is_super: true }), ann()])
    renderPage()
    expect(await screen.findByText("Ann Lee")).toBeTruthy()
    expect(screen.getAllByLabelText(/^Actions for/)).toHaveLength(1)
    expect(screen.queryByText("Make super user")).toBeNull()
    expect(screen.getByText(/ann · a@a.test/)).toBeTruthy()
  })

  it("asks before disabling, from the menu", async () => {
    const me = person({})
    serve(me, [me, ann()])
    renderPage()
    await screen.findByText("Ann Lee")
    openMenu("Ann Lee")
    fireEvent.click(await screen.findByText("Disable"))
    expect(await screen.findByText("Disable Ann Lee?")).toBeTruthy()
  })

  it("offers Enable, not Disable, for a disabled member", async () => {
    const me = person({})
    serve(me, [me, { ...ann(), disabled: true }])
    renderPage()
    await screen.findByText("Ann Lee")
    openMenu("Ann Lee")
    expect(await screen.findByText("Enable")).toBeTruthy()
    expect(screen.queryByText("Disable")).toBeNull()
  })

  it("never asks for the team when the signed-in person is not a super user", async () => {
    serve(person({ is_super: false }))
    renderPage()
    expect(await screen.findByText("Only a super user can manage the team.")).toBeTruthy()
    await waitFor(() => expect(fetchAdmin).not.toHaveBeenCalledWith("librarians"))
  })

  it("transfers only to a picked, enabled member, with your password, then leaves the page", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "PUT"
        ? ok({ ...ann(), is_super: true, transferred: true })
        : ok(path === "me" ? me : { librarians: [me, ann(), person({ id: 4, username: "off", is_super: false, disabled: true })] }))
    renderPage()
    await screen.findByText("Ann Lee")
    fireEvent.click(screen.getByText("Transfer super user"))
    const select = await screen.findByLabelText(/New super user/)
    expect(Array.from(select.querySelectorAll("option")).map((o) => o.textContent)).toEqual(["Choose a person", "Ann Lee — a@a.test"])
    const submit = () => screen.getByRole("button", { name: /^Transfer( to|$)/ })
    expect(submit().disabled).toBe(true)
    fireEvent.change(select, { target: { value: "2" } })
    expect(screen.getByText(/Ann Lee becomes the only super user. You become a normal member/)).toBeTruthy()
    expect(submit().disabled).toBe(true) // still no password
    fireEvent.change(screen.getByLabelText(/Confirm with your own password/), { target: { value: "my-password-1!" } })
    expect(submit().textContent).toBe("Transfer to Ann Lee")
    fireEvent.click(submit())
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("librarians/2", expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ is_super: true, current_password: "my-password-1!" }),
      })))
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"))
  })

  it("keeps a wrong password in the transfer form", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "PUT" ? refuse("The current password is wrong.") : ok(path === "me" ? me : { librarians: [me, ann()] }))
    renderPage()
    await screen.findByText("Ann Lee")
    fireEvent.click(screen.getByText("Transfer super user"))
    fireEvent.change(await screen.findByLabelText(/New super user/), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText(/Confirm with your own password/), { target: { value: "nope" } })
    fireEvent.click(screen.getByRole("button", { name: "Transfer to Ann Lee" }))
    expect(await screen.findByText("The current password is wrong.")).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it("says to add a person first when nobody can take the role", async () => {
    const me = person({})
    serve(me, [me])
    renderPage()
    await screen.findByText("Team")
    fireEvent.click(await screen.findByText("Transfer super user"))
    expect(await screen.findByText(/Add a person first/)).toBeTruthy()
    expect(screen.queryByLabelText(/New super user/)).toBeNull()
    fireEvent.click(screen.getAllByText("Add a person").find((el) => el.closest("[role=dialog]")))
    expect(await screen.findByLabelText(/^Name/)).toBeTruthy()
  })

  it("deletes only after your password", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "POST" ? ok({ deleted: true }) : ok(path === "me" ? me : { librarians: [me, ann()] }))
    renderPage()
    await screen.findByText("Ann Lee")
    openMenu("Ann Lee")
    fireEvent.click(await screen.findByText("Delete"))
    expect(await screen.findByText("Delete Ann Lee?")).toBeTruthy()
    expect(screen.getByText(/cannot be undone/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Delete" })) // no password yet
    expect(await screen.findByText("Enter your password.")).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Confirm with your own password/), { target: { value: "my-password-1!" } })
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("librarians/2/delete", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ current_password: "my-password-1!" }),
      })))
  })

  it("keeps a refused delete in the form", async () => {
    const me = person({})
    fetchAdmin.mockImplementation((path, init) =>
      init?.method === "POST" ? refuse("Invalid password.") : ok(path === "me" ? me : { librarians: [me, ann()] }))
    renderPage()
    await screen.findByText("Ann Lee")
    openMenu("Ann Lee")
    fireEvent.click(await screen.findByText("Delete"))
    fireEvent.change(await screen.findByLabelText(/Confirm with your own password/), { target: { value: "nope" } })
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(await screen.findByText("Invalid password.")).toBeTruthy()
    expect(screen.getByText("Delete Ann Lee?")).toBeTruthy()
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
})
