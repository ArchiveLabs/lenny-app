// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LibraryLinksBar } from "./LibraryLinksBar"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { toast } from "sonner"

jest.mock("@/hooks/use-library-links")
jest.mock("sonner", () => ({ toast: { success: jest.fn(), message: jest.fn() } }))
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const links = (over = {}) => ({
  opds_feed: "https://lenny.example/v1/api/opds", opds_book_template: "https://lenny.example/v1/api/opds/{olid}",
  reader_url: "https://reader.archive.org/?opds=https://lenny.example/v1/api/opds", is_public: true, ...over,
})
const setNavigator = (props) => Object.defineProperty(window, "navigator", { value: props, configurable: true })
const original = window.navigator
beforeEach(() => {
  jest.clearAllMocks()
  useLibraryLinks.mockReturnValue({ data: links() })
})
afterEach(() => Object.defineProperty(window, "navigator", { value: original, configurable: true }))

it("shows nothing, and no message, when the links could not be fetched", () => {
  useLibraryLinks.mockReturnValue({ data: undefined, isError: true })
  const { container } = render(<LibraryLinksBar />)
  expect(container).toBeEmptyDOMElement()
})

it("opens the OPDS feed in a new tab, with a hover text", () => {
  render(<LibraryLinksBar />)
  const feed = screen.getByRole("link", { name: "OPDS feed" })
  expect(feed).toHaveAttribute("href", "https://lenny.example/v1/api/opds")
  expect(feed).toHaveAttribute("target", "_blank")
  expect(feed).toHaveAttribute("rel", "noopener noreferrer")
  expect(feed).toHaveAttribute("title", "Lenny's catalog feed for reading apps")
})

it("opens Internet Archive's reader in a new tab, with a hover text", () => {
  render(<LibraryLinksBar />)
  const reader = screen.getByRole("link", { name: "Open in Internet Archive reader" })
  expect(reader).toHaveAttribute("href", "https://reader.archive.org/?opds=https://lenny.example/v1/api/opds")
  expect(reader).toHaveAttribute("target", "_blank")
  expect(reader).toHaveAttribute("rel", "noopener noreferrer")
  expect(reader).toHaveAttribute("title", "Browse this library in Internet Archive's reader")
})

it("copies the feed link from the small copy button next to it", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  setNavigator({ clipboard: { writeText } })
  render(<LibraryLinksBar />)
  fireEvent.click(screen.getByRole("button", { name: "Copy the OPDS feed link" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link copied", { duration: 2000 }))
  expect(writeText).toHaveBeenCalledWith("https://lenny.example/v1/api/opds")
})

it("shows the feed link in a message when the clipboard is blocked, so it can be copied by hand", async () => {
  setNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } })
  render(<LibraryLinksBar />)
  fireEvent.click(screen.getByRole("button", { name: "Copy the OPDS feed link" }))
  await waitFor(() => expect(toast.message).toHaveBeenCalledWith("https://lenny.example/v1/api/opds"))
  expect(toast.success).not.toHaveBeenCalled()
})

describe("the warning that the links are not public", () => {
  const WARNING = "These links only work on your own network. Set LENNY_PROXY in Lenny's .env to your domain to share them with others."

  it("shows beside the buttons when is_public is false, and still shows the buttons", () => {
    useLibraryLinks.mockReturnValue({ data: links({ is_public: false }) })
    render(<LibraryLinksBar />)
    expect(screen.getByText(WARNING)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "OPDS feed" })).toBeInTheDocument()
  })

  it("is not shown when the address is public", () => {
    render(<LibraryLinksBar />)
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()
  })
})

it("uses the reader link exactly as Lenny returns it, without building its own", () => {
  useLibraryLinks.mockReturnValue({ data: links({ opds_feed: "https://other.example/v1/api/opds", reader_url: "https://reader.archive.org/?opds=https://lender.briet.app/v1/api/opds" }) })
  render(<LibraryLinksBar />)
  expect(screen.getByRole("link", { name: "Open in Internet Archive reader" })).toHaveAttribute("href", "https://reader.archive.org/?opds=https://lender.briet.app/v1/api/opds")
})

it("names LENNY_PROXY, not LENNY_PUBLIC_URL, in the warning", () => {
  useLibraryLinks.mockReturnValue({ data: links({ is_public: false }) })
  render(<LibraryLinksBar />)
  expect(screen.getByRole("note")).toHaveTextContent("LENNY_PROXY")
  expect(screen.getByRole("note")).not.toHaveTextContent("LENNY_PUBLIC_URL")
})
