import { isHttpUrl, safeNextPath } from "./safe-url"

describe("isHttpUrl", () => {
  it.each(["http://a.test/x", "https://a.test/x?y=1"])("accepts %s", (u) => expect(isHttpUrl(u)).toBe(true))
  it.each(["javascript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "//a.test", "/relative", "", "ftp://a.test", null, 5])("rejects %p", (u) =>
    expect(isHttpUrl(u)).toBe(false))
})

describe("safeNextPath", () => {
  it.each(["/library", "/import?tab=x", "/"])("keeps %s", (p) => expect(safeNextPath(p)).toBe(p))
  it.each(["//evil.test", "/\\evil.test", "/\t/evil.test", "/\n/evil.test", "https://evil.test", "javascript:alert(1)", "evil", "", undefined])(
    "falls back to / for %p", (p) => expect(safeNextPath(p as string)).toBe("/"))
})
