// @ts-nocheck
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AppAccessPage from "./page"
import { fetchAdmin, redirectToLogin } from "@/lib/api-client"
import { ApiError } from "@/types/api"

jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  redirectToLogin: jest.fn(),
  handleApiResponse: jest.fn((res) => res.json()),
}))
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/settings/app-access",
  useSearchParams: () => new URLSearchParams(window.__search ?? ""),
}))

const list = {
  clients: [
    { client_id: "default", name: "Default app", redirect_uris: ["https://a.test/cb"], scopes: ["borrow"], is_confidential: false, status: "active", is_default: true, created_at: "" },
  ],
  available_scopes: [{ name: "loans:read", description: "Read loans" }, { name: "borrow", description: "Borrow" }],
  connection: {
    issuer: "http://localhost:8080", discovery_url: "http://localhost:8080/.well-known/openid-configuration",
    authorization_endpoint: "http://localhost:8080/authorize", token_endpoint: "http://localhost:8080/token",
    revocation_endpoint: "http://localhost:8080/revoke", grant_types: ["authorization_code"], pkce_method: "S256",
  },
}
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

const renderPage = () =>
  render(<QueryClientProvider client={new QueryClient()}><AppAccessPage /></QueryClientProvider>)

describe("AppAccessPage", () => {
  beforeEach(() => { jest.clearAllMocks(); window.__search = "" })

  it("shows each app as an On/Off switch with the redirect host, not Active/Disabled badges", async () => {
    fetchAdmin.mockReturnValue(ok(list))
    renderPage()
    expect(await screen.findByText("Default app")).toBeTruthy()
    const sw = screen.getByRole("switch", { name: "Let Default app sign in patrons" })
    expect(sw.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText("a.test")).toBeTruthy()
    expect(screen.getByText("Built in")).toBeTruthy()
    expect(screen.getByText("Patrons can sign in with this app.")).toBeTruthy()
    expect(screen.queryByText("Active")).toBeNull()
    expect(screen.queryByText("Disabled")).toBeNull()
    expect(screen.getByText("1 app can sign in patrons.")).toBeTruthy()
  })

  it("keeps details collapsed until asked and shows plain-words permissions inside", async () => {
    fetchAdmin.mockReturnValue(ok(list))
    renderPage()
    expect(await screen.findByText("Default app")).toBeTruthy()
    expect(screen.queryByText("Borrow and return books")).toBeNull()
    const toggle = screen.getByRole("button", { name: "Details" })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(toggle)
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Borrow and return books")).toBeTruthy()
    expect(screen.getByText("Browser or mobile app: no secret needed.")).toBeTruthy()
  })

  it("puts Off apps in a collapsed group after the On apps", async () => {
    const off = { ...list.clients[0], client_id: "old", name: "Old test app", status: "disabled", is_default: false }
    fetchAdmin.mockReturnValue(ok({ ...list, clients: [off, list.clients[0]] }))
    renderPage()
    expect(await screen.findByText("Default app")).toBeTruthy()
    expect(screen.queryByText("Old test app")).toBeNull()
    expect(screen.getByText("1 app can sign in patrons, 1 turned off.")).toBeTruthy()
    fireEvent.click(screen.getByText("Turned off (1)"))
    const sw = screen.getByRole("switch", { name: "Let Old test app sign in patrons" })
    expect(sw.getAttribute("aria-checked")).toBe("false")
    expect(screen.getByText("This app can't sign anyone in.")).toBeTruthy()
  })

  it("sends an expired admin session (401) to the login page instead of a broken page", async () => {
    fetchAdmin.mockResolvedValue({ ok: false, json: () => Promise.reject(new ApiError("Unauthorized", 401)) })
    renderPage()
    await waitFor(() => expect(redirectToLogin).toHaveBeenCalled())
  })

  it("explains an older Lenny without the endpoints (404)", async () => {
    fetchAdmin.mockResolvedValue({ ok: false, json: () => Promise.reject(new ApiError("Not found.", 404)) })
    renderPage()
    expect(await screen.findByText(/doesn't support App Access yet/)).toBeTruthy()
  })

  it("does not send a second PATCH when Save is clicked twice", async () => {
    let resolve
    fetchAdmin.mockImplementation((path, opts) =>
      opts?.method === "PATCH" ? new Promise((r) => { resolve = () => r({ ok: true, json: () => Promise.resolve({ ...list.clients[0], revoked_tokens: 0 }) }) }) : ok(list))
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: "Details" }))
    fireEvent.click(screen.getByText("Edit"))
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Renamed" } })
    const save = screen.getByText("Save changes").closest("button")
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(save.disabled).toBe(true))
    const patches = fetchAdmin.mock.calls.filter((c) => c[1] && c[1].method === "PATCH").length
    if (patches !== 1) throw new Error("PATCH calls: " + patches)
    resolve()
  })

  it("shows the empty state with an Add button", async () => {
    fetchAdmin.mockReturnValue(ok({ ...list, clients: [] }))
    renderPage()
    expect(await screen.findByText(/No apps yet/)).toBeTruthy()
  })

  it("hides client ID, type and permissions behind Advanced options, then POSTs and shows the one-time secret", async () => {
    fetchAdmin.mockImplementation((path, opts) =>
      opts?.method === "POST" ? ok({ ...list.clients[0], client_id: "x", client_secret: "s3cret" }) : ok(list))
    renderPage()
    await screen.findByText("Default app")
    fireEvent.click(screen.getByText("Add an app"))
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "My app" } })
    fireEvent.change(screen.getByLabelText("Redirect URLs"), { target: { value: "https://x.test/cb\nopds://cb" } })
    expect(screen.queryByLabelText(/Server app/)).toBeNull()
    fireEvent.click(screen.getByText("Advanced options"))
    fireEvent.click(screen.getByLabelText(/Server app/))
    fireEvent.click(screen.getByText("Register app"))
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("oauth2/clients", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "My app", redirect_uris: ["https://x.test/cb", "opds://cb"], public: false, scopes: ["loans:read", "borrow"] }),
      })))
    expect(await screen.findByText("s3cret")).toBeTruthy()
  })

  it("asks for confirmation in plain words before turning an app off", async () => {
    fetchAdmin.mockReturnValue(ok(list))
    renderPage()
    fireEvent.click(await screen.findByRole("switch", { name: "Let Default app sign in patrons" }))
    expect(await screen.findByText("Turn off Default app?")).toBeTruthy()
    expect(screen.getByText("Patrons signed in through it will need to sign in again.")).toBeTruthy()
    fireEvent.click(screen.getByText("Turn off"))
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("oauth2/clients/default/disable", expect.objectContaining({ method: "POST" })))
  })

  const server = { client_id: "srv", name: "Catalog", redirect_uris: ["https://c.test/cb"], scopes: ["loans:read", "borrow"], is_confidential: true, status: "disabled", is_default: false, created_at: "" }
  const openDetails = async (appName) => {
    await screen.findByText(appName)
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0])
  }

  it("built-in app: no Remove, plain explanation, no Reset secret for a public app", async () => {
    fetchAdmin.mockReturnValue(ok(list))
    renderPage()
    await openDetails("Default app")
    expect(screen.getByText("Built-in apps can't be removed. Turn it off instead.")).toBeTruthy()
    expect(screen.queryByText("Remove app")).toBeNull()
    expect(screen.queryByText("Reset secret")).toBeNull()
    expect(screen.getByText("Edit")).toBeTruthy()
  })

  it("an app that is On cannot be removed (hint instead)", async () => {
    const on = { ...server, status: "active" }
    fetchAdmin.mockReturnValue(ok({ ...list, clients: [on] }))
    renderPage()
    await openDetails("Catalog")
    expect(screen.queryByText("Remove app")).toBeNull()
    expect(screen.getByText("To remove this app, turn it off first.")).toBeTruthy()
    expect(screen.getByText("Reset secret")).toBeTruthy()
  })

  it("removes an Off app after a destructive confirm", async () => {
    fetchAdmin.mockImplementation((path, opts) => (opts?.method === "DELETE" ? ok({ client_id: "srv", deleted: true }) : ok({ ...list, clients: [server] })))
    renderPage()
    // only Off apps: the "Turned off" group opens by itself
    fireEvent.click(await screen.findByRole("button", { name: "Details" }))
    fireEvent.click(screen.getByText("Remove app"))
    expect(await screen.findByText("Remove Catalog?")).toBeTruthy()
    expect(screen.getByText("This deletes the app and its sign-ins. It can't be undone, but you can add the app again later.")).toBeTruthy()
    fireEvent.click(screen.getAllByText("Remove app").pop())
    await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("oauth2/clients/srv", expect.objectContaining({ method: "DELETE" })))
  })

  it("resets a server app's secret after confirm and shows the new secret once", async () => {
    fetchAdmin.mockImplementation((path, opts) =>
      opts?.method === "POST" ? ok({ client_id: "srv", client_secret: "n3w-secret" }) : ok({ ...list, clients: [server] }))
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: "Details" }))
    fireEvent.click(screen.getByText("Reset secret"))
    expect(await screen.findByText("Reset the secret for Catalog?")).toBeTruthy()
    fireEvent.click(screen.getAllByText("Reset secret").pop())
    await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("oauth2/clients/srv/rotate-secret", expect.objectContaining({ method: "POST" })))
    expect(await screen.findByText("n3w-secret")).toBeTruthy()
    fireEvent.click(screen.getByText("I've saved it"))
    await waitFor(() => expect(screen.queryByText("n3w-secret")).toBeNull())
  })

  it("edit sheet is prefilled, Save is disabled until a change, and PATCH sends only what changed", async () => {
    fetchAdmin.mockImplementation((path, opts) =>
      opts?.method === "PATCH" ? ok({ ...list.clients[0], name: "Renamed", revoked_tokens: 0 }) : ok(list))
    renderPage()
    await openDetails("Default app")
    fireEvent.click(screen.getByText("Edit"))
    const name = await screen.findByLabelText("Name")
    expect(name.value).toBe("Default app")
    expect(screen.getByLabelText("Redirect URLs").value).toBe("https://a.test/cb")
    expect(screen.getByText("The ID can't be changed because the app already uses it.")).toBeTruthy()
    const save = screen.getByText("Save changes").closest("button")
    expect(save.disabled).toBe(true)
    fireEvent.change(name, { target: { value: "Renamed" } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("oauth2/clients/default", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed" }) })))
  })

  it("removing a permission shows a note and needs a confirm before PATCH", async () => {
    fetchAdmin.mockImplementation((path, opts) =>
      opts?.method === "PATCH" ? ok({ ...list.clients[0], revoked_tokens: 3 }) : ok({ ...list, clients: [{ ...list.clients[0], scopes: ["loans:read", "borrow"] }] }))
    renderPage()
    await openDetails("Default app")
    fireEvent.click(screen.getByText("Edit"))
    await screen.findByLabelText("Name")
    fireEvent.click(screen.getByLabelText(/Borrow and return books/))
    expect(screen.getAllByText("Patrons signed in through this app will need to sign in again.").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText("Save changes"))
    expect(await screen.findByText("Save these changes?")).toBeTruthy()
    expect(fetchAdmin).not.toHaveBeenCalledWith("oauth2/clients/default", expect.anything())
    fireEvent.click(screen.getAllByText("Save changes").pop())
    await waitFor(() =>
      expect(fetchAdmin).toHaveBeenCalledWith("oauth2/clients/default", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ scopes: ["loans:read"] }) })))
  })

  it("links to the Patron Sign-in Provider page", async () => {
    fetchAdmin.mockReturnValue(ok(list))
    renderPage()
    const link = await screen.findByText("Patron Sign-in Provider")
    expect(link.closest("a").getAttribute("href")).toBe("/settings/external-auth")
  })

  it("shows connection endpoints on the For developers tab (?tab=developers)", async () => {
    window.__search = "tab=developers"
    fetchAdmin.mockReturnValue(ok(list))
    renderPage()
    expect(await screen.findByText("http://localhost:8080/token")).toBeTruthy()
    expect(screen.getByText("S256")).toBeTruthy()
  })
})
