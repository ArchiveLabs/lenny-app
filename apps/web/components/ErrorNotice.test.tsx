// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { ErrorNotice } from "./ErrorNotice"
import { redirectToLogin } from "@/lib/api-client"
import { ApiError } from "@/types/api"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/lib/api-client", () => ({ redirectToLogin: jest.fn() }))

beforeEach(() => jest.clearAllMocks())
const show = (error, props = {}) => {
  const onRetry = jest.fn()
  const onStartOver = jest.fn()
  render(<ErrorNotice error={error} onRetry={onRetry} onStartOver={onStartOver} {...props} />)
  return { onRetry, onStartOver }
}

it("uses the caller's words for who is down or what is gone", () => {
  show(new ApiError("x", 502), { texts: { unreachable: "Standard Ebooks did not answer." } })
  expect(screen.getByRole("alert")).toHaveTextContent("Standard Ebooks did not answer.")
})

it("has plain defaults when no words are given", () => {
  show(new ApiError("x", 404))
  expect(screen.getByRole("alert")).toHaveTextContent("This is not available any more.")
})

it("retries for an outside failure or an unknown one, but not for a 404 unless asked", () => {
  const a = show(new ApiError("x", 502))
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(a.onRetry).toHaveBeenCalled()
})

it("offers no retry for a 404 by default, and one when retryOn says so", () => {
  const { unmount } = render(<ErrorNotice error={new ApiError("x", 404)} onRetry={jest.fn()} />)
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  unmount()
  render(<ErrorNotice error={new ApiError("x", 404)} onRetry={jest.fn()} retryOn={["gone"]} />)
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
})

it("offers Start over for an expired thing, only when a handler is given", () => {
  const { onStartOver } = show(new ApiError("x", 410))
  fireEvent.click(screen.getByRole("button", { name: "Start over" }))
  expect(onStartOver).toHaveBeenCalled()
})

it("sends the admin to sign in on a 401 or 403", () => {
  show(new ApiError("x", 401))
  expect(redirectToLogin).toHaveBeenCalledTimes(1)
})

it("shows a server's own detail in small text, but hides a generic message", () => {
  show(new ApiError("Database is locked", 500))
  expect(screen.getByText("Database is locked")).toHaveClass("text-xs")
  expect(screen.getByText("Something went wrong. Try again.")).toBeInTheDocument()
})

it("draws a banner when boxed", () => {
  show(new TypeError("Failed to fetch"), { boxed: true })
  expect(screen.getByRole("alert").className).toContain("border-red-200")
  expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument()
})
