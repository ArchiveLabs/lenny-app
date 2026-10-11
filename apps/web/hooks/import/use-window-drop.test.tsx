// @ts-nocheck
import { act, renderHook } from "@testing-library/react"
import { useWindowDrop } from "./use-window-drop"
import { collectDropped } from "@/lib/import/walk"

jest.mock("@/lib/import/walk", () => ({ collectDropped: jest.fn() }))

const fire = (type: string, types = ["Files"]) => {
  const e = new Event(type, { bubbles: true, cancelable: true })
  e.dataTransfer = { types, items: [], dropEffect: "none" }
  act(() => void window.dispatchEvent(e))
  return e
}

const setup = (enabled = true) => {
  const onFiles = jest.fn()
  const onError = jest.fn()
  const hook = renderHook(() => useWindowDrop(onFiles, onError, enabled))
  return { onFiles, onError, ...hook }
}

beforeEach(() => collectDropped.mockReset())

it("shows the overlay while files are dragged over and survives child enter/leave pairs", () => {
  const { result } = setup()
  fire("dragenter") // window
  fire("dragenter") // child element
  fire("dragleave") // leaving the child
  expect(result.current).toBe(true)
  fire("dragleave") // leaving the window
  expect(result.current).toBe(false)
})

it("ignores drags that carry no files (text, links)", () => {
  const { result } = setup()
  const e = fire("dragenter", ["text/plain"])
  expect(result.current).toBe(false)
  expect(e.defaultPrevented).toBe(false)
})

it("prevents default on dragover and drop so the browser does not open the file", () => {
  setup()
  expect(fire("dragover").defaultPrevented).toBe(true)
  collectDropped.mockResolvedValue([])
  expect(fire("drop").defaultPrevented).toBe(true)
})

it("passes dropped files on and hides the overlay", async () => {
  const { result, onFiles } = setup()
  collectDropped.mockResolvedValue([{ path: "a.epub" }])
  fire("dragenter")
  fire("drop")
  await act(async () => {})
  expect(onFiles).toHaveBeenCalledWith([{ path: "a.epub" }])
  expect(result.current).toBe(false)
})

it("says so when nothing usable was dropped", async () => {
  const { onError, onFiles } = setup()
  collectDropped.mockResolvedValue([])
  fire("drop")
  await act(async () => {})
  expect(onFiles).not.toHaveBeenCalled()
  expect(onError).toHaveBeenCalledWith(expect.stringMatching(/No files found/))
})

it("reports a failed folder read instead of failing silently", async () => {
  const { onError } = setup()
  collectDropped.mockRejectedValue(new Error("NotFoundError"))
  fire("drop")
  await act(async () => {})
  expect(onError).toHaveBeenCalledWith("Could not read the dropped folder: NotFoundError")
})

it("does nothing when disabled", () => {
  const { result } = setup(false)
  const e = fire("dragenter")
  expect(result.current).toBe(false)
  expect(e.defaultPrevented).toBe(false)
})
