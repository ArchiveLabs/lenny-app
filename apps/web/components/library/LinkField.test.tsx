// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LinkField } from "./LinkField"
import { useLibraryLinks } from "@/hooks/use-library-links"

jest.mock("@/hooks/use-library-links")
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

it("shows the whole link in a read-only box", () => {
  render(<LinkField olid="OL123M" />)
  const field = screen.getByLabelText("Share link")
  expect(field).toHaveValue("https://lenny.example/v1/api/opds/123")
  expect(field).toHaveAttribute("readonly")
})

it("copies it with a labelled Copy button that says Copied", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  setNavigator({ clipboard: { writeText } })
  render(<LinkField olid="OL123M" />)
  fireEvent.click(screen.getByRole("button", { name: "Copy share link" }))
  await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument())
  expect(writeText).toHaveBeenCalledWith("https://lenny.example/v1/api/opds/123")
})

it("says so when the clipboard is blocked", async () => {
  setNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } })
  render(<LinkField olid="OL123M" />)
  fireEvent.click(screen.getByRole("button", { name: "Copy share link" }))
  await waitFor(() => expect(screen.getByText("Couldn't copy")).toBeInTheDocument())
})
