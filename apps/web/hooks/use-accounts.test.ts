/** @jest-environment node */
// @ts-nocheck
import { deleteLibrarian } from "./use-accounts"
import { fetchAdmin } from "@/lib/api-client"

// Only the network is faked: the real response check runs, as in the browser.
jest.mock("@/lib/api-client", () => ({ ...jest.requireActual("@/lib/api-client"), fetchAdmin: jest.fn(), redirectToLogin: jest.fn() }))

const reply = (body, status = 200) => fetchAdmin.mockResolvedValue(new Response(JSON.stringify(body), { status }))

describe("deleteLibrarian", () => {
  beforeEach(() => jest.clearAllMocks())

  it("accepts Lenny's {deleted: true}, which is not a person", async () => {
    reply({ deleted: true })
    await expect(deleteLibrarian(2, "pw")).resolves.toEqual({ deleted: true })
    expect(fetchAdmin).toHaveBeenCalledWith("librarians/2/delete", expect.objectContaining({ method: "POST", body: JSON.stringify({ current_password: "pw" }) }))
  })

  it("surfaces Lenny's reason when it refuses", async () => {
    reply({ detail: "You cannot delete your own account." }, 400)
    await expect(deleteLibrarian(1, "pw")).rejects.toThrow("You cannot delete your own account.")
  })
})
