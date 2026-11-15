// @ts-nocheck
import { render, screen, within } from "@testing-library/react"
import SettingsPage from "./page"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))
const apps = { data: undefined }
const ghost = { data: undefined }
jest.mock("@/hooks/use-oauth2-clients", () => ({ useOAuth2Clients: () => apps }))
jest.mock("@/hooks/use-ghost-settings", () => ({ useGhostSettings: () => ghost }))

const links = (section) => within(screen.getByRole("region", { name: section })).getAllByRole("link").map((a) => a.getAttribute("href"))

it("groups settings into Lending, and Plugins & connectors", () => {
  render(<SettingsPage />)
  expect(links("Lending")).toEqual(["/settings/lending-mode", "/settings/loan-limits"])
  expect(links("Plugins & connectors")).toEqual(["/settings/ghost", "/settings/openlibrary", "/settings/external-auth", "/settings/app-access"])
})

it("shows whether Ghost is live, and how many apps are active", () => {
  ghost.data = { site_url: "https://hydra.test", enabled: false }
  apps.data = { clients: [{ status: "active" }, { status: "active" }, { status: "disabled" }] }
  render(<SettingsPage />)
  expect(screen.getByRole("link", { name: /Ghost subscriptions/ })).toHaveTextContent("Turned off")
  expect(screen.getByRole("link", { name: /App Access/ })).toHaveTextContent("2 active apps, 1 disabled")
})

it("shows no status it doesn't know, never undefined", () => {
  ghost.data = undefined
  apps.data = undefined
  render(<SettingsPage />)
  expect(screen.queryByText(/Connected|Turned off|active app/)).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/undefined/)
})
