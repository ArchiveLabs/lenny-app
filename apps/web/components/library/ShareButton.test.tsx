// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ShareButton } from "./ShareButton"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { toast } from "sonner"

jest.mock("@/hooks/use-library-links")
jest.mock("sonner", () => ({ toast: { success: jest.fn(), message: jest.fn() } }))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const links = { opds_book_template: "https://lenny.example/v1/api/opds/{olid}", opds_feed: "https://lenny.example/v1/api/opds", reader_url: "https://lenny.example/", is_public: true }
const setNavigator = (props) => Object.defineProperty(window, "navigator", { value: props, configurable: true })
const original = window.navigator

beforeEach(() => {
  jest.clearAllMocks()
  useLibraryLinks.mockReturnValue({ data: links })
})
afterEach(() => Object.defineProperty(window, "navigator", { value: original, configurable: true }))

const press = () => fireEvent.click(screen.getByRole("button", { name: "Share Dune" }))

it("is not shown when the links are not available", () => {
  useLibraryLinks.mockReturnValue({ data: undefined })
  const { container } = render(<ShareButton olid="OL123M" title="Dune" />)
  expect(container).toBeEmptyDOMElement()
})

it("copies the book's link, with the edition number put in, and says so for two seconds", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  setNavigator({ clipboard: { writeText } })
  render(<ShareButton olid="OL123M" title="Dune" />)
  press()
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link copied", { duration: 2000 }))
  expect(writeText).toHaveBeenCalledWith("https://lenny.example/?opds=https%3A%2F%2Flenny.example%2Fv1%2Fapi%2Fopds%2F123")
})

it("uses the system share sheet where there is one, with the title and link, and does not also copy", async () => {
  const share = jest.fn().mockResolvedValue(undefined)
  const writeText = jest.fn()
  setNavigator({ share, clipboard: { writeText } })
  render(<ShareButton olid="OL123M" title="Dune" />)
  press()
  await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "Dune", url: "https://lenny.example/?opds=https%3A%2F%2Flenny.example%2Fv1%2Fapi%2Fopds%2F123" }))
  expect(writeText).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

it("copies instead when the share sheet is cancelled", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  setNavigator({ share: jest.fn().mockRejectedValue(new DOMException("x", "AbortError")), clipboard: { writeText } })
  render(<ShareButton olid="OL123M" title="Dune" />)
  press()
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link copied", { duration: 2000 }))
  expect(writeText).toHaveBeenCalled()
})

describe("when the clipboard is blocked", () => {
  beforeEach(() => setNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } }))

  it("shows the link in a small popover instead, with no Link copied message", async () => {
    render(<ShareButton olid="OL123M" title="Dune" />)
    press()
    const field = await screen.findByLabelText("Link to share")
    expect(field).toHaveValue("https://lenny.example/?opds=https%3A%2F%2Flenny.example%2Fv1%2Fapi%2Fopds%2F123")
    expect(field).toHaveAttribute("readonly")
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByText("Your browser did not allow copying. Select the link and copy it.")).toBeInTheDocument()
  })

  it("selects the link when the field is focused, so it can be copied by hand", async () => {
    render(<ShareButton olid="OL123M" title="Dune" />)
    press()
    const field = await screen.findByLabelText("Link to share")
    const select = jest.spyOn(field, "select")
    fireEvent.focus(field)
    expect(select).toHaveBeenCalled()
  })

  it("closes with Escape", async () => {
    render(<ShareButton olid="OL123M" title="Dune" />)
    press()
    await screen.findByLabelText("Link to share")
    fireEvent.keyDown(screen.getByLabelText("Link to share"), { key: "Escape" })
    await waitFor(() => expect(screen.queryByLabelText("Link to share")).not.toBeInTheDocument())
  })
})

it("does not let the click reach the card around it, which would open the book sheet", async () => {
  setNavigator({ clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } })
  const onCard = jest.fn()
  render(<div onClick={onCard}><ShareButton olid="OL1M" title="Dune" /></div>)
  press()
  await waitFor(() => expect(toast.success).toHaveBeenCalled())
  expect(onCard).not.toHaveBeenCalled()
})

it("has a label that names the book and a short hover text", () => {
  render(<ShareButton olid="OL1M" title="Dune" />)
  expect(screen.getByRole("button", { name: "Share Dune" })).toHaveAttribute("title", "Share this book's link")
})

describe("size", () => {
  it("is 28px by default and a smaller 24px with a smaller icon when compact", () => {
    const { unmount } = render(<ShareButton olid="OL1M" title="Dune" />)
    expect(screen.getByRole("button", { name: "Share Dune" }).className).toContain("h-7 w-7")
    unmount()
    render(<ShareButton olid="OL1M" title="Dune" compact />)
    const button = screen.getByRole("button", { name: "Share Dune" })
    expect(button.className).toContain("h-6 w-6")
    expect(button.querySelector("svg").getAttribute("class")).toContain("h-3.5 w-3.5")
  })
})
