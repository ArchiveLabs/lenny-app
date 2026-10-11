// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EditionError, errorKind } from "./EditionError"
import { redirectToLogin } from "@/lib/api-client"
import { ApiError } from "@/types/api"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/lib/api-client", () => ({ redirectToLogin: jest.fn() }))

const show = (error) => {
  const qc = new QueryClient()
  const spy = jest.spyOn(qc, "invalidateQueries")
  const onRetry = jest.fn()
  const onStartOver = jest.fn()
  render(<QueryClientProvider client={qc}><EditionError error={error} onRetry={onRetry} onStartOver={onStartOver} /></QueryClientProvider>)
  return { onRetry, onStartOver, spy }
}

beforeEach(() => jest.clearAllMocks())

describe("errorKind", () => {
  it.each([[502, "unreachable"], [404, "gone"], [410, "expired"], [401, "signin"], [403, "signin"], [500, "other"], [503, "other"], [400, "other"]])(
    "%s is %s",
    (status, kind) => expect(errorKind(new ApiError("x", status))).toBe(kind),
  )
  it("treats a network error as other", () => expect(errorKind(new TypeError("Failed to fetch"))).toBe("other"))
})

it("502: says Open Library did not answer, with a retry", () => {
  const { onRetry } = show(new ApiError("bad gateway", 502))
  expect(screen.getByText("Open Library did not answer. Try again in a moment.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(onRetry).toHaveBeenCalled()
})

it("404: says the book is no longer in the list, reloads the list, and offers no retry", async () => {
  const { spy } = show(new ApiError("Not found.", 404))
  expect(screen.getByText("This book is no longer in the list.")).toBeInTheDocument()
  expect(screen.queryByText(/Open Library did not answer/)).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["import-rows"] }))
})

it("410: says the list expired and offers Start over", () => {
  const { onStartOver } = show(new ApiError("gone", 410))
  expect(screen.getByText("This list has expired.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Start over" }))
  expect(onStartOver).toHaveBeenCalled()
})

it.each([401, 403])("%s: sends the admin to sign in", (status) => {
  show(new ApiError("nope", status))
  expect(screen.getByText("Your session ended. Taking you to sign in…")).toBeInTheDocument()
  expect(redirectToLogin).toHaveBeenCalledTimes(1)
})

it("a 500 says something went wrong, shows the server's detail small, and retries", () => {
  const { onRetry } = show(new ApiError("Database is locked", 500))
  expect(screen.getByText("Something went wrong. Try again.")).toBeInTheDocument()
  expect(screen.getByText("Database is locked")).toHaveClass("text-xs")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(onRetry).toHaveBeenCalled()
})

it("hides a generic message instead of repeating it", () => {
  show(new ApiError("The server had a problem. Try again in a moment.", 500))
  expect(screen.queryByText("The server had a problem. Try again in a moment.")).not.toBeInTheDocument()
})

it("a network error says something went wrong, not that Open Library is down", () => {
  show(new TypeError("Failed to fetch"))
  expect(screen.getByText("Something went wrong. Try again.")).toBeInTheDocument()
  expect(screen.queryByText(/Open Library/)).not.toBeInTheDocument()
})
