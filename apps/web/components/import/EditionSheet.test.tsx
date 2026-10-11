// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EditionSheet } from "./EditionSheet"
import { importApi } from "@/lib/import/api"
import { ApiError } from "@/types/api"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/lib/import/api", () => ({ importApi: { candidates: jest.fn(), searchEditions: jest.fn() } }))

const row = { id: 4, title: "Dune", path: "a.epub", olid: null }

it("focuses the search box on open and still lists the suggestions", async () => {
  importApi.candidates.mockResolvedValue({ candidates: [{ olid: 9, title: "Dune (1965)", authors: [], score: 88, in_library: false }] })
  const onPick = jest.fn().mockResolvedValue(undefined)
  const onClose = jest.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditionSheet batchId={7} row={row} onClose={onClose} onPick={onPick} onStartOver={jest.fn()} />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByLabelText("Search Open Library")).toHaveFocus())
  fireEvent.click(await screen.findByText("Dune (1965)"))
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(row, 9))
  expect(onClose).toHaveBeenCalled()
})

it("shows the honest reason when the suggestions fail", async () => {
  importApi.candidates.mockRejectedValue(new ApiError("Not found.", 404))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditionSheet batchId={7} row={row} onClose={jest.fn()} onPick={jest.fn()} onStartOver={jest.fn()} />
    </QueryClientProvider>,
  )
  expect(await screen.findByText("This book is no longer in the list.")).toBeInTheDocument()
  expect(screen.queryByText(/Open Library did not answer/)).not.toBeInTheDocument()
})

describe("choosing an edition", () => {
  const cand = { olid: 9, title: "Dune (1965)", authors: [], score: 88, in_library: false }
  const open = (onPick) => {
    importApi.candidates.mockResolvedValue({ candidates: [cand] })
    const onClose = jest.fn()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EditionSheet batchId={7} row={row} onClose={onClose} onPick={onPick} onStartOver={jest.fn()} />
      </QueryClientProvider>,
    )
    return onClose
  }

  it("closes after the edition was changed", async () => {
    const onClose = open(jest.fn().mockResolvedValue(undefined))
    fireEvent.click(await screen.findByText("Dune (1965)"))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("stays open and says so inside the panel when the change fails", async () => {
    const onClose = open(jest.fn().mockRejectedValue(new ApiError("Database is locked", 500)))
    fireEvent.click(await screen.findByText("Dune (1965)"))
    expect(await screen.findByText("The edition was not changed.")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong. Try again.")).toBeInTheDocument()
    expect(screen.getByText("Database is locked")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("retries the same edition from the error", async () => {
    const onPick = jest.fn().mockRejectedValueOnce(new ApiError("boom", 500)).mockResolvedValue(undefined)
    const onClose = open(onPick)
    fireEvent.click(await screen.findByText("Dune (1965)"))
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onPick).toHaveBeenCalledTimes(2)
    expect(onPick).toHaveBeenLastCalledWith(row, 9)
  })

  it("shows a spinner while the change is in flight, since Open Library is asked first", async () => {
    let finish
    open(jest.fn().mockImplementation(() => new Promise((ok) => (finish = ok))))
    fireEvent.click(await screen.findByText("Dune (1965)"))
    expect(await screen.findByText("Changing the edition…")).toBeInTheDocument()
    finish()
    await waitFor(() => expect(screen.queryByText("Changing the edition…")).not.toBeInTheDocument())
  })

  it("does not send a second change while one is in flight", async () => {
    let finish
    const onPick = jest.fn().mockImplementation(() => new Promise((ok) => (finish = ok)))
    open(onPick)
    const card = await screen.findByText("Dune (1965)")
    fireEvent.click(card)
    fireEvent.click(card)
    expect(onPick).toHaveBeenCalledTimes(1)
    finish()
  })
})
