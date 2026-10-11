// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { DropZone } from "./DropZone"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const coarse = (on: boolean) => {
  window.matchMedia = (q: string) => ({ matches: on && q.includes("coarse"), media: q, addEventListener() {}, removeEventListener() {} })
}
afterEach(() => coarse(false))

const hasDirInput = () => {
  // jsdom lacks webkitdirectory; pretend it is supported like every desktop browser
  Object.defineProperty(HTMLInputElement.prototype, "webkitdirectory", { value: "", configurable: true, writable: true })
}

it("offers a folder picker on desktop when webkitdirectory is supported", () => {
  hasDirInput()
  render(<DropZone onPick={jest.fn()} />)
  expect(screen.getByRole("button", { name: "Choose a folder" })).toBeInTheDocument()
})

it("hides the folder picker on touch devices and leads with Choose files", () => {
  hasDirInput()
  coarse(true)
  render(<DropZone onPick={jest.fn()} />)
  expect(screen.queryByRole("button", { name: "Choose a folder" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Choose files" })).toBeInTheDocument()
})

it("uses the directory picker when the page offers one", () => {
  const onChooseFolder = jest.fn()
  coarse(false)
  render(<DropZone onPick={jest.fn()} onChooseFolder={onChooseFolder} />)
  fireEvent.click(screen.getByRole("button", { name: "Choose a folder" }))
  expect(onChooseFolder).toHaveBeenCalled()
})

it("the files input takes multiple EPUBs and does not rely on the MIME type alone", () => {
  render(<DropZone onPick={jest.fn()} />)
  const input = screen.getByTestId("files-input")
  expect(input).toHaveAttribute("multiple")
  expect(input.getAttribute("accept")).toContain(".epub") // Windows/Android report no type for .epub
})

it("passes picked files with their relative paths and drops hidden ones", () => {
  const onPick = jest.fn()
  render(<DropZone onPick={onPick} />)
  const f = new File(["x"], "a.epub")
  Object.defineProperty(f, "webkitRelativePath", { value: "L/a.epub" })
  const hidden = new File(["x"], ".DS_Store")
  fireEvent.change(screen.getByTestId("files-input"), { target: { files: [f, hidden] } })
  expect(onPick).toHaveBeenCalledWith([{ file: f, path: "L/a.epub" }])
})

it("never shows Choose files as the blue primary button before it knows folders are offered", () => {
  const { container } = render(<DropZone onPick={jest.fn()} onChooseFolder={jest.fn()} />)
  // After mount the folder button exists and Choose files is the outline one.
  expect(screen.getByRole("button", { name: "Choose a folder" })).toBeInTheDocument()
  const files = screen.getByRole("button", { name: "Choose files" })
  expect(files.className).not.toMatch(/bg-primary(?!\/)/)
  expect(container.querySelector(".invisible")).toBeNull()
})
