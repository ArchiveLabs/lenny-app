// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { NativeSelect } from "./NativeSelect"

const show = (props = {}) =>
  render(
    <NativeSelect aria-label="Sort" defaultValue="a" {...props}>
      <option value="a">A-Z</option>
      <option value="b">Newest first</option>
    </NativeSelect>,
  )

it("is still the browser's select, so phones get their own picker and tests can choose by value", () => {
  show()
  const select = screen.getByLabelText("Sort")
  expect(select.tagName).toBe("SELECT")
  fireEvent.change(select, { target: { value: "b" } })
  expect(select).toHaveValue("b")
})

it("passes the change handler and the value through", () => {
  const onChange = jest.fn()
  render(
    <NativeSelect aria-label="Sort" value="a" onChange={onChange}>
      <option value="a">A-Z</option>
      <option value="b">Newest first</option>
    </NativeSelect>,
  )
  fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "b" } })
  expect(onChange).toHaveBeenCalled()
})

it("hides the browser's small default arrow and draws its own chevron, which does not catch clicks", () => {
  const { container } = show()
  expect(screen.getByLabelText("Sort").className).toContain("appearance-none")
  const chevron = container.querySelector("svg")
  expect(chevron).toBeInTheDocument()
  expect(chevron.getAttribute("class")).toContain("pointer-events-none")
  expect(chevron.getAttribute("aria-hidden")).toBe("true")
})

it("leaves room on the right so the text never runs under the chevron", () => {
  show()
  expect(screen.getByLabelText("Sort").className).toContain("pr-9")
})

it("takes the app's field styling: border, height, focus ring", () => {
  show()
  const cls = screen.getByLabelText("Sort").className
  expect(cls).toContain("h-9")
  expect(cls).toContain("border-input")
  expect(cls).toContain("focus-visible:ring-[3px]")
})

it("lets the caller change the size, and can be disabled", () => {
  show({ className: "h-8", disabled: true })
  expect(screen.getByLabelText("Sort").className).toContain("h-8")
  expect(screen.getByLabelText("Sort")).toBeDisabled()
})
