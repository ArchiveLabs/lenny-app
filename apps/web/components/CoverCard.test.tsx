// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { COVER_GRID, CoverCard, CoverCardSkeleton } from "./CoverCard"

const show = (props = {}) => render(<CoverCard title="Database Internals" author="Alex Petrov" coverUrl="/c.jpg" {...props} />)

describe("size and spacing", () => {
  it("makes the tiles compact: 132px at least, with a moderate gap", () => {
    expect(COVER_GRID).toContain("minmax(132px,1fr)")
    expect(COVER_GRID).toContain("gap-x-4")
    expect(COVER_GRID).toContain("gap-y-6")
  })

  it("is smaller than the first redesign (170px tiles, 20px gaps)", () => {
    expect(COVER_GRID).not.toContain("170px")
    expect(COVER_GRID).not.toContain("gap-x-5")
  })

  it("uses a smaller title and keeps the author line smaller still", () => {
    show()
    expect(screen.getByText("Database Internals").className).toContain("text-[13px]")
    expect(screen.getByText("Alex Petrov").className).toContain("text-xs")
  })

  it("keeps room between the cover and the text", () => {
    const { container } = show()
    expect(container.querySelector('[role="button"]').className).toContain("gap-2.5")
  })

  it("has a skeleton in the same shape", () => {
    const { container } = render(<CoverCardSkeleton />)
    expect(container.querySelector(".aspect-\\[2\\/3\\]")).toBeInTheDocument()
  })
})

describe("the card", () => {
  it("shows the cover, title and author", () => {
    show()
    expect(screen.getByRole("img", { name: "Database Internals cover" })).toHaveAttribute("src", "/c.jpg")
    expect(screen.getByText("Database Internals")).toBeInTheDocument()
    expect(screen.getByText("Alex Petrov")).toBeInTheDocument()
  })

  it("shows a placeholder when there is no cover, and no author line when there is no author", () => {
    show({ coverUrl: null, author: null })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByText("Alex Petrov")).not.toBeInTheDocument()
  })

  it("clamps the title to two lines and the author to one, as paragraphs", () => {
    show()
    const title = screen.getByText("Database Internals")
    const author = screen.getByText("Alex Petrov")
    expect(title.tagName).toBe("P")
    expect(title.className).toContain("line-clamp-2")
    expect(author.className).toContain("line-clamp-1")
    expect(title.className).not.toMatch(/(^|\s)(block|flex)(\s|$)/)
    expect(title.className).not.toMatch(/min-h|h-10/)
  })

  it("shows the full title and author on hover", () => {
    show()
    expect(screen.getByText("Database Internals")).toHaveAttribute("title", "Database Internals")
    expect(screen.getByText("Alex Petrov")).toHaveAttribute("title", "Alex Petrov")
  })

  it("puts what the caller gives on the cover, under the author, and in the hover action", () => {
    const { container } = show({ topLeft: <span>lock</span>, status: <span>status</span>, hoverAction: <button>act</button> })
    const cover = container.querySelector(".aspect-\\[2\\/3\\]")
    expect(cover).toContainElement(screen.getByText("lock"))
    expect(cover).toContainElement(screen.getByText("act"))
    expect(cover).not.toContainElement(screen.getByText("status"))
  })

  it("shows the hover action only on hover or focus, and always on touch screens", () => {
    show({ hoverAction: <button>act</button> })
    const bar = screen.getByText("act").closest(".opacity-0")
    expect(bar.className).toContain("group-hover:opacity-100")
    expect(bar.className).toContain("focus-within:opacity-100")
    expect(bar.className).toContain("[@media(hover:none)]:opacity-100")
  })

  it("has no hover bar when there is no hover action", () => {
    const { container } = show()
    expect(container.querySelector(".opacity-0")).not.toBeInTheDocument()
  })

  it("does not pass a click on the hover action through to the card", () => {
    const onCard = jest.fn()
    render(<div onClick={onCard}><CoverCard title="T" hoverAction={<button>act</button>} /></div>)
    fireEvent.click(screen.getByText("act"))
    expect(onCard).not.toHaveBeenCalled()
  })

  it("rings the cover when picked", () => {
    const { container, rerender } = show({ picked: true })
    expect(container.querySelector(".aspect-\\[2\\/3\\]").className).toContain("ring-primary")
    rerender(<CoverCard title="T" picked={false} />)
    expect(container.querySelector(".aspect-\\[2\\/3\\]").className).not.toContain("ring-primary")
  })
})

describe("as a button", () => {
  it("is focusable, and Enter or Space does what a click does", () => {
    const { container } = show()
    const card = container.querySelector('[role="button"]')
    expect(card).toHaveAttribute("tabindex", "0")
    const click = jest.fn()
    card.addEventListener("click", click)
    fireEvent.keyDown(card, { key: "Enter" })
    fireEvent.keyDown(card, { key: " " })
    fireEvent.keyDown(card, { key: "x" })
    expect(click).toHaveBeenCalledTimes(2)
  })

  it("ignores Enter pressed on something inside it", () => {
    const { container } = show({ hoverAction: <button>act</button> })
    const card = container.querySelector('[role="button"]')
    const click = jest.fn()
    card.addEventListener("click", click)
    fireEvent.keyDown(screen.getByText("act"), { key: "Enter" })
    expect(click).not.toHaveBeenCalled()
  })
})

describe("on a phone", () => {
  it("fits three covers across a phone-width screen: tiles from 104px with tighter gaps", () => {
    expect(COVER_GRID.split(" ").filter((c) => !c.includes(":"))).toEqual(expect.arrayContaining(["grid-cols-[repeat(auto-fill,minmax(104px,1fr))]", "gap-x-3", "gap-y-5"]))
    // 3 tiles of 104px and two 12px gaps fit in 340px
    expect(3 * 104 + 2 * 12).toBeLessThanOrEqual(340)
  })

  it("goes back to the larger tiles from the sm breakpoint", () => {
    expect(COVER_GRID).toContain("sm:grid-cols-[repeat(auto-fill,minmax(132px,1fr))]")
    expect(COVER_GRID).toContain("sm:gap-x-4")
  })
})
