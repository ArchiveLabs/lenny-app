// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LoginForm } from "./login-form"

const push = jest.fn()
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }))
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const fill = () => {
  fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: "a@b.co" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } })
}

describe("LoginForm", () => {
  beforeEach(() => { push.mockClear(); global.fetch = jest.fn() })

  it("says what is missing instead of sending", async () => {
    render(<LoginForm />)
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    expect(screen.getByText("Enter your email or username.")).toBeTruthy()
    expect(screen.getByText("Enter your password.")).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("shows the server's message and stays on the page", async () => {
    global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Invalid email, username or password." }) })
    render(<LoginForm />)
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    expect((await screen.findByRole("alert")).textContent).toContain("Invalid email, username or password.")
    expect(push).not.toHaveBeenCalled()
  })

  it("goes to the requested page on success", async () => {
    global.fetch.mockResolvedValue({ ok: true })
    render(<LoginForm redirectTo="/team" />)
    fill()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/team"))
  })
})
