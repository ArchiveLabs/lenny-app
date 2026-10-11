// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EditionSheet } from "./EditionSheet"
import { importApi } from "@/lib/import/api"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/lib/import/api", () => ({ importApi: { candidates: jest.fn(), searchEditions: jest.fn() } }))

const row = { id: 4, title: "Dune", path: "a.epub", olid: null }

it("focuses the search box on open and still lists the suggestions", async () => {
  importApi.candidates.mockResolvedValue({ candidates: [{ olid: 9, title: "Dune (1965)", authors: [], score: 88, in_library: false }] })
  const onPick = jest.fn().mockResolvedValue(undefined)
  const onClose = jest.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditionSheet batchId={7} row={row} onClose={onClose} onPick={onPick} />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByLabelText("Search Open Library")).toHaveFocus())
  fireEvent.click(await screen.findByText("Dune (1965)"))
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(row, 9))
  expect(onClose).toHaveBeenCalled()
})
