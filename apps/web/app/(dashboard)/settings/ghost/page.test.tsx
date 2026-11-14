// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import GhostSettingsPage from "./page"
import { fetchAdmin } from "@/lib/api-client"
import { ApiError } from "@/types/api"
import { toast } from "sonner"

jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  handleApiResponse: jest.fn((res) => res.json()),
}))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const settings = {
  site_url: "https://hydra.test",
  allowed_tier_ids: ["tier-a", "tier-z"],
  seen_tiers: [{ id: "tier-a", members: 12 }, { id: "tier-b", members: 1 }],
  snippet: "<script src=\"lenny.js\"></script>",
  webhook_url: "https://lenny.test/v1/api/subscriptions/ghost/webhook",
  webhook_secret: "s3cret",
  last_webhook_at: null,
  enabled: true,
  lease_hours: 24,
}
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GhostSettingsPage /></QueryClientProvider>)

beforeEach(() => jest.clearAllMocks())

it("sums up what is live: reading on, the site, and whether cancellations reach Lenny", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  expect(await screen.findByRole("switch", { name: "Members-only reading" })).toBeChecked()
  expect(screen.getByRole("link", { name: "hydra.test" })).toHaveAttribute("href", "https://hydra.test")
  expect(screen.getByText("Not set up")).toBeInTheDocument()
  expect(screen.getByText("Connected")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "See subscription stats" })).toHaveAttribute("href", "/stats")
  expect(screen.getByRole("link", { name: "Member passes" })).toHaveAttribute("href", "/loans?view=members")
  expect(screen.getByText("24 hours")).toBeInTheDocument()
})

it("says cancellations work once a webhook has arrived, and folds the setup away", async () => {
  fetchAdmin.mockReturnValue(ok({ ...settings, last_webhook_at: new Date().toISOString() }))
  renderPage()
  expect(await screen.findByText("Working")).toBeInTheDocument()
  expect(screen.getByText("Add the code to Ghost").closest("details")).not.toHaveAttribute("open")
  expect(screen.getByText("Add a Read button to a post").closest("details")).toHaveAttribute("open")
})

it("lists every tier by name, ticks the saved ones, and keeps unknown IDs as text", async () => {
  fetchAdmin.mockReturnValue(ok({ ...settings, tier_names: { "tier-a": "Gold", "tier-c": "Silver" } }))
  renderPage()
  expect(await screen.findByRole("radio", { name: "Only members of these tiers" })).toBeChecked()
  expect(screen.getByText("Gold")).toHaveAttribute("title", "tier-a")
  expect(screen.getByText("tier-b")).toBeInTheDocument() // no name: its id
  expect(screen.getByText("Silver")).toBeInTheDocument()
  expect(screen.getByText("12 members")).toBeInTheDocument()
  expect(screen.getByText("0 members")).toBeInTheDocument()
  const boxes = screen.getAllByRole("checkbox")
  expect(boxes).toHaveLength(3)
  expect(boxes[0]).toHaveAttribute("aria-checked", "true")
  expect(boxes[1]).toHaveAttribute("aria-checked", "false")
  expect(screen.getByLabelText("Other tier IDs, separated by commas")).toHaveValue("tier-z")
})

it("saves only the tiers, and only once something changed", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  const save = await screen.findByRole("button", { name: "Save" })
  expect(save).toBeDisabled()
  fireEvent.click(screen.getAllByRole("checkbox")[1])
  fireEvent.change(screen.getByLabelText("Other tier IDs, separated by commas"), { target: { value: "tier-z, tier-y tier-a" } })
  fireEvent.click(save)
  await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("settings/ghost", expect.objectContaining({ method: "PUT" })))
  const body = JSON.parse(fetchAdmin.mock.calls.find(([, o]) => o?.method === "PUT")[1].body)
  expect(body).toEqual({ allowed_tier_ids: ["tier-a", "tier-b", "tier-z", "tier-y"] })
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved."))
})

it("lets any paid member read by saving no tiers, and won't save an empty tier list", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  fireEvent.click(await screen.findByRole("radio", { name: "Any paid member" }))
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("settings/ghost", expect.objectContaining({ method: "PUT" })))
  expect(JSON.parse(fetchAdmin.mock.calls.at(-1)[1].body)).toEqual({ allowed_tier_ids: [] })

  fireEvent.click(screen.getByRole("radio", { name: "Only members of these tiers" }))
  screen.getAllByRole("checkbox").filter((b) => b.getAttribute("aria-checked") === "true").forEach((b) => fireEvent.click(b))
  fireEvent.change(screen.getByLabelText("Other tier IDs, separated by commas"), { target: { value: "" } })
  expect(screen.getByText("Pick at least one tier.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
})

it("gives the snippet, webhook URL and secret with copy buttons, and the Starter note", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  expect(await screen.findByLabelText("Code injection snippet")).toHaveValue(settings.snippet)
  expect(screen.getByLabelText("Webhook URL")).toHaveValue(settings.webhook_url)
  expect(screen.getByLabelText("Webhook secret")).toHaveValue("s3cret")
  expect(screen.getByLabelText("Webhook secret")).toHaveAttribute("type", "password")
  expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Copy webhook secret" })).toBeInTheDocument()
  expect(screen.getByText(/Ghost\(Pro\) Starter doesn't send custom webhooks/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Learn more about members-only books" })).toHaveAttribute("rel", "noopener noreferrer")
  expect(screen.getByRole("link", { name: "Learn more about ending access with webhooks" }).getAttribute("href")).toMatch(/subscriptions\.md#webhooks-end-access-when-a-member-cancels$/)
  expect(screen.getByRole("link", { name: "Open the Library" })).toHaveAttribute("href", "/library")
})

it("makes a new secret only after confirming, and shows it", async () => {
  fetchAdmin.mockReturnValueOnce(ok(settings)).mockReturnValueOnce(ok({ webhook_secret: "fresh" }))
  renderPage()
  await screen.findByLabelText("Webhook secret")
  fireEvent.click(screen.getByRole("button", { name: "Make a new secret" }))
  expect(fetchAdmin).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getAllByRole("button", { name: "Make a new secret" }).at(-1))
  await waitFor(() => expect(screen.getByLabelText("Webhook secret")).toHaveValue("fresh"))
  expect(fetchAdmin).toHaveBeenLastCalledWith("settings/ghost/webhook-secret", { method: "POST" })
})

describe("before a site is saved", () => {
  const none = { ...settings, site_url: null, snippet: null, allowed_tier_ids: [], seen_tiers: [] }

  it("asks only for the site", async () => {
    fetchAdmin.mockReturnValue(ok(none))
    renderPage()
    expect(await screen.findByText("Not connected")).toBeInTheDocument()
    expect(screen.getByText("Connect your Ghost site")).toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Webhook secret")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "See subscription stats" })).not.toBeInTheDocument()
  })

  it("connects with just the site", async () => {
    fetchAdmin.mockReturnValueOnce(ok(none)).mockReturnValueOnce(ok(settings))
    renderPage()
    fireEvent.change(await screen.findByLabelText("Ghost site URL"), { target: { value: " https://hydra.test " } })
    fireEvent.click(screen.getByRole("button", { name: "Connect" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ghost connected."))
    expect(JSON.parse(fetchAdmin.mock.calls.at(-1)[1].body)).toEqual({ site_url: "https://hydra.test" })
    expect(await screen.findByRole("switch")).toBeChecked()
  })

  it("shows the server's reason when the site can't be checked", async () => {
    fetchAdmin.mockReturnValueOnce(ok(none))
    renderPage()
    fireEvent.change(await screen.findByLabelText("Ghost site URL"), { target: { value: "https://hydra.test" } })
    const { handleApiResponse } = jest.requireMock("@/lib/api-client")
    handleApiResponse.mockImplementationOnce(() => Promise.reject(new ApiError("Couldn't reach hydra.test.", 422)))
    fetchAdmin.mockReturnValueOnce(ok({}))
    fireEvent.click(screen.getByRole("button", { name: "Connect" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't reach hydra.test."))
  })
})

it("asks to update Lenny when the server has no Ghost settings", async () => {
  fetchAdmin.mockReturnValue(ok(null))
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  handleApiResponse.mockImplementationOnce(() => Promise.reject(new ApiError("Not found.", 404)))
  renderPage()
  expect(await screen.findByText(/doesn't support Ghost yet/)).toBeInTheDocument()
})

describe("changing the site", () => {
  const edit = async (value) => {
    fireEvent.click(await screen.findByRole("button", { name: "Change" }))
    fireEvent.change(screen.getByLabelText("Ghost site URL"), { target: { value } })
    fireEvent.click(screen.getByRole("button", { name: "Save site" }))
  }

  it("asks first, since members of the old site lose access, and sends only the site", async () => {
    fetchAdmin.mockReturnValue(ok(settings))
    renderPage()
    await edit("https://other.test")
    expect(screen.getByText("Members of https://hydra.test lose access to subscription books right away.")).toBeInTheDocument()
    expect(fetchAdmin).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Change site" }))
    await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("settings/ghost", expect.objectContaining({ method: "PUT" })))
    expect(JSON.parse(fetchAdmin.mock.calls.at(-1)[1].body)).toEqual({ site_url: "https://other.test" })
  })

  it("asks before disconnecting", async () => {
    fetchAdmin.mockReturnValue(ok(settings))
    renderPage()
    await edit("")
    expect(screen.getByText("Disconnect Ghost?")).toBeInTheDocument()
  })

  it("saves nothing when the site is unchanged", async () => {
    fetchAdmin.mockReturnValue(ok(settings))
    renderPage()
    await edit("https://hydra.test")
    expect(screen.queryByText("Change the Ghost site?")).not.toBeInTheDocument()
    expect(fetchAdmin).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument()
  })
})

describe("the on/off switch", () => {
  it("turns Ghost off without forgetting the site, and says so", async () => {
    fetchAdmin.mockReturnValueOnce(ok(settings)).mockReturnValueOnce(ok({ ...settings, enabled: false }))
    renderPage()
    const sw = await screen.findByRole("switch", { name: "Members-only reading" })
    fireEvent.click(sw)
    await waitFor(() => expect(fetchAdmin).toHaveBeenLastCalledWith("settings/ghost", expect.objectContaining({ method: "PUT" })))
    expect(JSON.parse(fetchAdmin.mock.calls.at(-1)[1].body)).toEqual({ enabled: false })
    expect(await screen.findByText("Turned off")).toBeInTheDocument()
    expect(sw).not.toBeChecked()
    expect(screen.getByRole("link", { name: "hydra.test" })).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith("Ghost turned off.")
  })

  it("turns it back on", async () => {
    fetchAdmin.mockReturnValueOnce(ok({ ...settings, enabled: false })).mockReturnValueOnce(ok(settings))
    renderPage()
    const sw = await screen.findByRole("switch")
    expect(screen.getByText(/can't read subscription books until you turn it back on/)).toBeInTheDocument()
    fireEvent.click(sw)
    await waitFor(() => expect(sw).toBeChecked())
    expect(JSON.parse(fetchAdmin.mock.calls.at(-1)[1].body)).toEqual({ enabled: true })
  })
})
