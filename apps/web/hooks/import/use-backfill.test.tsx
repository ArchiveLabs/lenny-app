// @ts-nocheck
import { renderHook } from "@testing-library/react"
import { useBackfillMatchDetails } from "./use-backfill"

const row = (id, over = {}) => ({ id, state: "matched", olid: 100 + id, match_title: null, ...over })

it("asks once for each linked row that has no matched title", async () => {
  const fill = jest.fn().mockResolvedValue({})
  renderHook(() => useBackfillMatchDetails([row(1), row(2)], fill))
  await Promise.resolve()
  expect(fill.mock.calls.map((c) => c[0].id)).toEqual([1, 2])
})

it("does not ask again for the same row when the list re-renders or reloads", async () => {
  const fill = jest.fn().mockResolvedValue({})
  const { rerender } = renderHook(({ rows }) => useBackfillMatchDetails(rows, fill), { initialProps: { rows: [row(1)] } })
  rerender({ rows: [row(1)] })
  rerender({ rows: [row(1), row(2)] })
  await Promise.resolve()
  expect(fill.mock.calls.map((c) => c[0].id)).toEqual([1, 2])
})

it("leaves rows alone that are not linked, already have a title, or are importing", async () => {
  const fill = jest.fn().mockResolvedValue({})
  renderHook(() => useBackfillMatchDetails([row(1, { olid: null }), row(2, { match_title: "Dune" }), row(3, { state: "importing" })], fill))
  await Promise.resolve()
  expect(fill).not.toHaveBeenCalled()
})

it("ignores a failure, and a callback that throws", async () => {
  const fill = jest.fn().mockImplementation((r) => {
    if (r.id === 1) throw new Error("sync")
    return Promise.reject(new Error("async"))
  })
  expect(() => renderHook(() => useBackfillMatchDetails([row(1), row(2)], fill))).not.toThrow()
  await new Promise((ok) => setTimeout(ok, 5))
  expect(fill).toHaveBeenCalledTimes(2)
})
