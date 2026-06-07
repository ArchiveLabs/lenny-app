// @ts-nocheck
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { IaAuthToggle } from "./IaAuthToggle"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fetchAdmin } from "@/lib/api-client"

// Mock fetchAdmin
jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  handleApiResponse: jest.fn((res) => res),
}))

// Mock react-i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (str: string) => str,
  }),
}))

describe("IaAuthToggle", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient()
    jest.clearAllMocks()
  })

  it("POSTs {enabled: true} when toggled on and confirmed", async () => {
    ;(fetchAdmin as jest.Mock).mockResolvedValueOnce({})

    render(
      <QueryClientProvider client={queryClient}>
        <IaAuthToggle initialEnabled={false} />
      </QueryClientProvider>
    )

    const checkbox = screen.getByRole("checkbox")
    fireEvent.click(checkbox)

    const confirmButton = await screen.findByText("Confirm")
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(fetchAdmin).toHaveBeenCalledWith("ia-auth/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      })
    })
  })

  it("POSTs {enabled: false} when toggled off and confirmed", async () => {
    ;(fetchAdmin as jest.Mock).mockResolvedValueOnce({})

    render(
      <QueryClientProvider client={queryClient}>
        <IaAuthToggle initialEnabled={true} />
      </QueryClientProvider>
    )

    const checkbox = screen.getByRole("checkbox")
    fireEvent.click(checkbox)

    const confirmButton = await screen.findByText("Confirm")
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(fetchAdmin).toHaveBeenCalledWith("ia-auth/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      })
    })
  })
})
