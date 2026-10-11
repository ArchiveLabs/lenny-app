// @ts-nocheck
import { act, renderHook } from "@testing-library/react"
import { useCatalogRefresh } from "./use-preload"
import { preloadApi } from "@/lib/preload/api"

jest.mock("@/lib/preload/api", () => ({ preloadApi: { refresh: jest.fn() } }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))
jest.mock("@tanstack/react-query", () => ({ ...jest.requireActual("@tanstack/react-query"), useQueryClient: () => ({}) }))

const page = (refreshing) => ({ data: { pages: [{ refreshing }] } })

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(0)
  preloadApi.refresh.mockReset().mockResolvedValue({ started: true })
})
afterEach(() => jest.useRealTimers())

const start = async (refetch) => {
  const hook = renderHook(() => useCatalogRefresh(refetch))
  let done
  act(() => { done = hook.result.current.refresh() })
  return { hook, done: () => done }
}
const tick = (ms) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })

it("asks the server to check archive.org, and shows it is checking", async () => {
  const refetch = jest.fn().mockResolvedValue(page(false))
  const { hook } = await start(refetch)
  expect(preloadApi.refresh).toHaveBeenCalledTimes(1)
  await act(async () => { await Promise.resolve() })
  expect(hook.result.current.checking).toBe(true)
})

it("reloads the catalog every 3 seconds while it is rebuilding, then once more when it is done", async () => {
  const refetch = jest.fn().mockResolvedValueOnce(page(true)).mockResolvedValueOnce(page(true)).mockResolvedValue(page(false))
  const { hook } = await start(refetch)
  await tick(3000)
  expect(refetch).toHaveBeenCalledTimes(1)
  await tick(3000)
  expect(refetch).toHaveBeenCalledTimes(2)
  await tick(3000) // the third answer says it is done: one more reload, then stop
  expect(refetch).toHaveBeenCalledTimes(4)
  expect(hook.result.current.checking).toBe(false)
  await tick(30_000)
  expect(refetch).toHaveBeenCalledTimes(4)
})

it("stops after 60 seconds if it is still rebuilding", async () => {
  const refetch = jest.fn().mockResolvedValue(page(true))
  const { hook } = await start(refetch)
  await tick(60_000)
  expect(refetch.mock.calls.length).toBeLessThanOrEqual(21)
  expect(hook.result.current.checking).toBe(false)
  const calls = refetch.mock.calls.length
  await tick(30_000)
  expect(refetch).toHaveBeenCalledTimes(calls)
})

it("waits the same way when a rebuild was already running (started false)", async () => {
  preloadApi.refresh.mockResolvedValue({ started: false })
  const refetch = jest.fn().mockResolvedValueOnce(page(true)).mockResolvedValue(page(false))
  const { hook } = await start(refetch)
  await tick(3000)
  expect(hook.result.current.checking).toBe(true)
  await tick(3000)
  expect(hook.result.current.checking).toBe(false)
  expect(refetch).toHaveBeenCalledTimes(3)
})

it("keeps the failure and stops checking when the refresh itself fails", async () => {
  preloadApi.refresh.mockRejectedValue(new Error("bad gateway"))
  const refetch = jest.fn()
  const { hook } = await start(refetch)
  await act(async () => { await Promise.resolve() })
  expect(hook.result.current.error).toEqual(new Error("bad gateway"))
  expect(hook.result.current.checking).toBe(false)
  expect(refetch).not.toHaveBeenCalled()
})

it("clears an earlier failure when tried again", async () => {
  preloadApi.refresh.mockRejectedValueOnce(new Error("x")).mockResolvedValue({ started: true })
  const refetch = jest.fn().mockResolvedValue(page(false))
  const { hook } = await start(refetch)
  await act(async () => { await Promise.resolve() })
  expect(hook.result.current.error).not.toBeNull()
  act(() => { hook.result.current.refresh() })
  await act(async () => { await Promise.resolve() })
  expect(hook.result.current.error).toBeNull()
})
