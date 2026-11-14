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
}
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GhostSettingsPage /></QueryClientProvider>)

beforeEach(() => jest.clearAllMocks())

it("shows the saved site, tiers seen at launches, and other tier IDs as text", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  expect(await screen.findByLabelText("Ghost site URL")).toHaveValue("https://hydra.test")
  expect(screen.getByText("12 members")).toBeInTheDocument()
  expect(screen.getByText("1 member")).toBeInTheDocument()
  const boxes = screen.getAllByRole("checkbox")
  expect(boxes[0]).toHaveAttribute("aria-checked", "true")
  expect(boxes[1]).toHaveAttribute("aria-checked", "false")
  expect(screen.getByLabelText("Other tier IDs, separated by commas")).toHaveValue("tier-z")
})

it("saves the site, the ticked and typed tiers, and nothing else", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  await screen.findByLabelText("Ghost site URL")
  fireEvent.click(screen.getAllByRole("checkbox")[1])
  fireEvent.change(screen.getByLabelText("Other tier IDs, separated by commas"), { target: { value: "tier-z, tier-y tier-a" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("settings/ghost", expect.objectContaining({ method: "PUT" })))
  const body = JSON.parse(fetchAdmin.mock.calls.find(([, o]) => o?.method === "PUT")[1].body)
  expect(body).toEqual({
    site_url: "https://hydra.test",
    allowed_tier_ids: ["tier-a", "tier-b", "tier-z", "tier-y"],
  })
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved."))
})

it("shows the server's reason when the site can't be checked", async () => {
  fetchAdmin.mockReturnValueOnce(ok(settings))
  renderPage()
  await screen.findByLabelText("Ghost site URL")
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  handleApiResponse.mockImplementationOnce(() => Promise.reject(new ApiError("Couldn't reach hydra.test.", 422)))
  fetchAdmin.mockReturnValueOnce(ok({}))
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't reach hydra.test."))
})

it("gives the snippet, webhook URL and secret with copy buttons, and the Starter note", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  expect(await screen.findByLabelText("Code injection snippet")).toHaveValue(settings.snippet)
  expect(screen.getByLabelText("Webhook URL")).toHaveValue(settings.webhook_url)
  expect(screen.getByLabelText("Webhook secret")).toHaveValue("s3cret")
  expect(screen.getByLabelText("Webhook secret")).toHaveAttribute("type", "password")
  expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument()
  expect(screen.getByText("No webhook received yet")).toBeInTheDocument()
  expect(screen.getByText("Connected")).toBeInTheDocument()
  expect(screen.getByText(/Ghost\(Pro\) Starter doesn't send custom webhooks/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Learn more about members-only books" })).toHaveAttribute("rel", "noopener noreferrer")
  expect(screen.getByRole("link", { name: "Learn more about ending access with webhooks" }).getAttribute("href")).toMatch(/subscriptions\.md#webhooks-end-access-when-a-member-cancels$/)
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

it("says Ghost is not connected until a site URL is saved", async () => {
  fetchAdmin.mockReturnValue(ok({ ...settings, site_url: null, snippet: null, allowed_tier_ids: [], seen_tiers: [] }))
  renderPage()
  expect(await screen.findByText("Not connected")).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Ghost isn't connected yet")
  expect(screen.queryByLabelText("Webhook secret")).not.toBeInTheDocument()
})

it("asks to update Lenny when the server has no Ghost settings", async () => {
  fetchAdmin.mockReturnValue(ok(null))
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  handleApiResponse.mockImplementationOnce(() => Promise.reject(new ApiError("Not found.", 404)))
  renderPage()
  expect(await screen.findByText(/doesn't support Ghost yet/)).toBeInTheDocument()
})

it("asks before changing the site, since members of the old one lose access", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  fireEvent.change(await screen.findByLabelText("Ghost site URL"), { target: { value: "https://other.test" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.getByText("Members of https://hydra.test lose access to subscription books right away.")).toBeInTheDocument()
  expect(fetchAdmin).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Change site" }))
  await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("settings/ghost", expect.objectContaining({ method: "PUT" })))
})

it("asks before disconnecting", async () => {
  fetchAdmin.mockReturnValue(ok(settings))
  renderPage()
  fireEvent.change(await screen.findByLabelText("Ghost site URL"), { target: { value: "" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.getByText("Disconnect Ghost?")).toBeInTheDocument()
})

describe("the on/off switch", () => {
  it("turns Ghost off without forgetting the site, and says so", async () => {
    fetchAdmin.mockReturnValueOnce(ok(settings)).mockReturnValueOnce(ok({ ...settings, enabled: false }))
    renderPage()
    const sw = await screen.findByRole("switch", { name: "Let Ghost members read subscription books" })
    expect(sw).toBeChecked()
    expect(screen.getByText("Connected")).toBeInTheDocument()
    fireEvent.click(sw)
    await waitFor(() => expect(fetchAdmin).toHaveBeenLastCalledWith("settings/ghost", expect.objectContaining({ method: "PUT" })))
    expect(JSON.parse(fetchAdmin.mock.calls.at(-1)[1].body)).toEqual({ enabled: false })
    expect(await screen.findByText("Turned off")).toBeInTheDocument()
    expect(sw).not.toBeChecked()
    expect(screen.getByLabelText("Ghost site URL")).toHaveValue("https://hydra.test")
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

  it("can't be turned on before a site is saved", async () => {
    fetchAdmin.mockReturnValue(ok({ ...settings, site_url: null, snippet: null }))
    renderPage()
    const sw = await screen.findByRole("switch")
    expect(sw).toBeDisabled()
    expect(sw).not.toBeChecked()
    expect(screen.getByText("Save your Ghost site URL below to turn this on.")).toBeInTheDocument()
  })
})
