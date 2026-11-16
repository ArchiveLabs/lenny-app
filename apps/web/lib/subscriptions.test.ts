import { isEditionOlid, readButtonHtml } from "./subscriptions"

it("accepts only an edition id for a Read link", () => {
  expect(isEditionOlid("OL32930303M")).toBe(true)
  for (const bad of ["OL1W", "32930303", "OL1M\"><script>", "OL1M/../x", ""]) expect(isEditionOlid(bad)).toBe(false)
})

it("builds the HTML card as a plain link on the site", () => {
  expect(readButtonHtml("https://hydra.test/", "OL1M")).toBe('<a href="https://hydra.test/#lenny-book=OL1M">Read</a>')
})
