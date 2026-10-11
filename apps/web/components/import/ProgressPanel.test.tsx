// @ts-nocheck
import { render, screen } from "@testing-library/react"
import { ProgressPanel } from "./ProgressPanel"

it("shows nothing when nothing is running", () => {
  const { container } = render(<ProgressPanel stages={[]} />)
  expect(container).toBeEmptyDOMElement()
})

it("shows each running stage with its count and a labelled bar", () => {
  render(<ProgressPanel stages={[{ key: "a", label: "Reading books", done: 5, total: 10 }, { key: "b", label: "Uploading files", done: 1200, total: 5000 }]} />)
  expect(screen.getByRole("progressbar", { name: "Reading books" })).toHaveAttribute("aria-valuenow", "50")
  expect(screen.getByRole("progressbar", { name: "Uploading files" })).toHaveAttribute("aria-valuenow", "24")
  expect(screen.getByText("5 / 10")).toBeInTheDocument()
  expect(screen.getByText("1,200 / 5,000")).toBeInTheDocument()
})

it("shows a quiet hint under a stage", () => {
  render(<ProgressPanel stages={[{ key: "u", label: "Uploading files", done: 1, total: 2, hint: "You can leave this page." }]} />)
  expect(screen.getByText("You can leave this page.")).toBeInTheDocument()
})

it("does not divide by zero", () => {
  render(<ProgressPanel stages={[{ key: "a", label: "Matching", done: 0, total: 0 }]} />)
  expect(screen.getByRole("progressbar", { name: "Matching" })).toHaveAttribute("aria-valuenow", "0")
})

it("is announced politely and does not add loading statuses of its own", () => {
  const { container } = render(<ProgressPanel stages={[{ key: "a", label: "Reading", done: 1, total: 2 }]} />)
  expect(container.firstChild).toHaveAttribute("aria-live", "polite")
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})
