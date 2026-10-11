// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EditionSearch } from "./EditionSearch"
import { importApi } from "@/lib/import/api"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/lib/import/api", () => ({ importApi: { searchEditions: jest.fn() } }))

const cand = (olid, over = {}) => ({ olid, title: `Book ${olid}`, authors: ["A"], year: 2000, score: 90, in_library: false, ...over })
const row = { id: 4, olid: null }
const setup = () => {
  const onPick = jest.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditionSearch batchId={7} row={row} onPick={onPick} />
    </QueryClientProvider>,
  )
  return { onPick, box: screen.getByLabelText("Search Open Library") }
}
const type = (box, v) => fireEvent.change(box, { target: { value: v } })

beforeEach(() => importApi.searchEditions.mockReset())

it("searches after a pause, not on every key, and never under 2 characters", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [cand(1)] })
  const { box } = setup()
  type(box, "d")
  expect(screen.getByText("Type at least 2 characters.")).toBeInTheDocument()
  type(box, "du")
  type(box, "dune")
  await screen.findByText("Book 1")
  expect(importApi.searchEditions).toHaveBeenCalledTimes(1)
  expect(importApi.searchEditions).toHaveBeenCalledWith(7, 4, "dune")
})

it("searches at once on Enter", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [cand(1)] })
  const { box } = setup()
  type(box, "OL123M")
  fireEvent.keyDown(box, { key: "Enter" })
  await waitFor(() => expect(importApi.searchEditions).toHaveBeenCalledWith(7, 4, "OL123M"))
})

it("ignores a slow answer to an older search", async () => {
  let slow
  importApi.searchEditions.mockImplementation((_b, _r, q) =>
    q === "old" ? new Promise((ok) => (slow = ok)) : Promise.resolve({ candidates: [cand(2, { title: "Fresh" })] }),
  )
  const { box } = setup()
  type(box, "old")
  fireEvent.keyDown(box, { key: "Enter" })
  type(box, "new")
  fireEvent.keyDown(box, { key: "Enter" })
  await screen.findByText("Fresh")
  slow({ candidates: [cand(1, { title: "Stale" })] })
  await new Promise((ok) => setTimeout(ok, 20))
  expect(screen.queryByText("Stale")).not.toBeInTheDocument()
})

it("picks with the keyboard: arrows move, Enter chooses", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [cand(1), cand(2)] })
  const { box, onPick } = setup()
  type(box, "dune")
  await screen.findByText("Book 2")
  fireEvent.keyDown(box, { key: "ArrowDown" })
  fireEvent.keyDown(box, { key: "ArrowDown" })
  fireEvent.keyDown(box, { key: "Enter" })
  expect(onPick).toHaveBeenCalledWith(2)
})

it("picks by click", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [cand(5)] })
  const { box, onPick } = setup()
  type(box, "dune")
  fireEvent.click(await screen.findByText("Book 5"))
  expect(onPick).toHaveBeenCalledWith(5)
})

it("shows the percentage only from 60, and labels the top result by order otherwise", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [cand(1, { score: 72 }), cand(2, { score: 30 })] })
  const { box } = setup()
  type(box, "dune")
  await screen.findByText("Book 1")
  expect(screen.getByText(/72%/)).toBeInTheDocument()
  expect(screen.queryByText(/30%/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Top result/)).not.toBeInTheDocument() // a strong match exists
})

it("with no strong match, shows no percentages and calls the first one the top result", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [cand(1, { score: 30 }), cand(2, { score: 10 })] })
  const { box } = setup()
  type(box, "dune")
  await screen.findByText("Book 1")
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  expect(screen.getAllByText(/Top result/)).toHaveLength(1)
})

it("flags editions already in the library but still lets them be chosen", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [cand(1, { in_library: true })] })
  const { box, onPick } = setup()
  type(box, "dune")
  expect(await screen.findByText("Already in your library")).toBeInTheDocument()
  fireEvent.click(screen.getByText("Book 1"))
  expect(onPick).toHaveBeenCalledWith(1)
})

it("offers the Open Library add link when nothing is found", async () => {
  importApi.searchEditions.mockResolvedValue({ candidates: [] })
  const { box } = setup()
  type(box, "zzzz")
  await screen.findByText(/No editions found/)
  expect(screen.getByRole("link", { name: /Add it on Open Library/ })).toHaveAttribute("href", "https://openlibrary.org/books/add")
})

it("says Open Library is not answering and retries", async () => {
  importApi.searchEditions.mockRejectedValueOnce(new Error("502")).mockResolvedValue({ candidates: [cand(1)] })
  const { box } = setup()
  type(box, "dune")
  await screen.findByText("Open Library is not answering. Try again.")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  await screen.findByText("Book 1")
})
