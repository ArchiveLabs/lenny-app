// @ts-nocheck
import { copyText, shareLink } from "./share"

const setNavigator = (props) => {
  Object.defineProperty(window, "navigator", { value: props, configurable: true })
}
const original = window.navigator
afterEach(() => Object.defineProperty(window, "navigator", { value: original, configurable: true }))

describe("copyText", () => {
  it("copies to the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    setNavigator({ clipboard: { writeText } })
    expect(await copyText("https://x/1")).toBe("copied")
    expect(writeText).toHaveBeenCalledWith("https://x/1")
  })

  it("says blocked when the browser refuses", async () => {
    setNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } })
    expect(await copyText("x")).toBe("blocked")
  })

  it("says blocked when there is no clipboard at all (an insecure page)", async () => {
    setNavigator({})
    expect(await copyText("x")).toBe("blocked")
  })
})

describe("shareLink", () => {
  it("uses the system share sheet with the title and link where there is one", async () => {
    const share = jest.fn().mockResolvedValue(undefined)
    const writeText = jest.fn()
    setNavigator({ share, clipboard: { writeText } })
    expect(await shareLink({ title: "Dune", url: "https://x/1" })).toBe("shared")
    expect(share).toHaveBeenCalledWith({ title: "Dune", url: "https://x/1" })
    expect(writeText).not.toHaveBeenCalled()
  })

  it("copies instead when the share sheet is cancelled", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    setNavigator({ share: jest.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")), clipboard: { writeText } })
    expect(await shareLink({ title: "Dune", url: "https://x/1" })).toBe("copied")
    expect(writeText).toHaveBeenCalledWith("https://x/1")
  })

  it("copies instead when sharing fails", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    setNavigator({ share: jest.fn().mockRejectedValue(new Error("not allowed")), clipboard: { writeText } })
    expect(await shareLink({ title: "T", url: "u" })).toBe("copied")
  })

  it("copies when there is no share sheet (a desktop)", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    setNavigator({ clipboard: { writeText } })
    expect(await shareLink({ title: "T", url: "u" })).toBe("copied")
  })

  it("says blocked when there is no share sheet and the clipboard is blocked", async () => {
    setNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } })
    expect(await shareLink({ title: "T", url: "u" })).toBe("blocked")
  })

  it("says blocked when sharing is cancelled and the clipboard is blocked too", async () => {
    setNavigator({ share: jest.fn().mockRejectedValue(new Error("x")), clipboard: { writeText: jest.fn().mockRejectedValue(new Error("y")) } })
    expect(await shareLink({ title: "T", url: "u" })).toBe("blocked")
  })
})
