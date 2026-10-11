import { ImportsResponseSchema } from "./api"

const job = (over = {}) => ({ source: "standardebooks", olid: 1, title: "T", status: "done", ...over })

describe("the /admin/imports response", () => {
  it("accepts a job with no source, as books imported through a batch have", () => {
    const r = ImportsResponseSchema.parse({ imports: [job({ source: null }), job({ source: undefined })] })
    expect(r.imports).toHaveLength(2)
    expect(r.imports[0]!.source).toBeNull()
  })

  it("still reads a Standard Ebooks or BRIET job", () => {
    const r = ImportsResponseSchema.parse({ imports: [job(), job({ source: "briet", status: "downloading" })] })
    expect(r.imports.map((j) => j.source)).toEqual(["standardebooks", "briet"])
  })

  it("still rejects an unknown status", () => {
    expect(() => ImportsResponseSchema.parse({ imports: [job({ status: "weird" })] })).toThrow()
  })
})
