// @ts-nocheck
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ProfileForm } from "./profile-form"
import { fetchAdmin } from "@/lib/api-client"

jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  redirectToLogin: jest.fn(),
  handleApiResponse: jest.fn((res) => res.json()),
}))
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const renderForm = () =>
  render(<QueryClientProvider client={new QueryClient()}><ProfileForm id={1} name="Ann" email="ann@a.test" /></QueryClientProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  fetchAdmin.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
})

it("keeps Save off until something changes", () => {
  renderForm()
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
})

it("sends only the field that changed", async () => {
  renderForm()
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Ann Lee" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("librarians/1", expect.objectContaining({ body: JSON.stringify({ name: "Ann Lee" }) })))
})

it("shows a message under each bad field and sends nothing", async () => {
  renderForm()
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: " " } })
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "nope" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("Enter a name.")).toBeTruthy()
  expect(screen.getByText("Enter a valid email address.")).toBeTruthy()
  expect(fetchAdmin).not.toHaveBeenCalled()
})
