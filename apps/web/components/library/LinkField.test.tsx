// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LinkField } from "./LinkField"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { toast } from "sonner"

jest.mock("@/hooks/use-library-links")
jest.mock("sonner", () => ({ toast: { success: jest.fn() } }))
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const links = { opds_book_template: "https://lenny.example/v1/api/opds/{olid}", opds_feed: "f", reader_url: "r", is_public: true }
const setNavigator = (props) => Object.defineProperty(window, "navigator", { value: props, configurable: true })
const original = window.navigator
beforeEach(() => {
  jest.clearAllMocks()
  useLibraryLinks.mockReturnValue({ data: links })
})
afterEach(() => Object.defineProperty(window, "navigator", { value: original, configurable: true }))

it("is not shown when the links are not available", () => {
  useLibraryLinks.mockReturnValue({ data: undefined })
  const { container } = render(<LinkField olid="OL123M" />)
  expect(container).toBeEmptyDOMElement()
})

it("shows the book's link in a read-only field", () => {
  render(<LinkField olid="OL123M" />)
  const field = screen.getByLabelText("Share link (OPDS)")
  expect(field).toHaveValue("https://lenny.example/v1/api/opds/123")
  expect(field).toHaveAttribute("readonly")
})

it("copies it from the button and says so", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  setNavigator({ clipboard: { writeText } })
  render(<LinkField olid="OL123M" />)
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link copied", { duration: 2000 }))
  expect(writeText).toHaveBeenCalledWith("https://lenny.example/v1/api/opds/123")
})

it("selects the link for copying by hand when the clipboard is blocked", async () => {
  setNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } })
  render(<LinkField olid="OL123M" />)
  const field = screen.getByLabelText("Share link (OPDS)")
  const select = jest.spyOn(field, "select")
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
  await waitFor(() => expect(select).toHaveBeenCalled())
  expect(toast.success).not.toHaveBeenCalled()
})

it("says an encrypted book needs a login to read", () => {
  render(<LinkField olid="OL123M" encrypted />)
  expect(screen.getByText("This book requires a login to read.")).toBeInTheDocument()
})

it("says nothing about a login for an open book", () => {
  render(<LinkField olid="OL123M" encrypted={false} />)
  expect(screen.queryByText(/requires a login/)).not.toBeInTheDocument()
})
