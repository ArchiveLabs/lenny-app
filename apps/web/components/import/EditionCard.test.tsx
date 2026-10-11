// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { EditionCard, SHOW_SCORE_FROM, STRONG_SCORE, scoreTone } from "./EditionCard"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const cand = (over = {}) => ({ olid: 50213396, title: "How to Read a Book", authors: ["Mortimer J. Adler"], year: 2014, publisher: "Simon & Schuster", language: "eng", in_library: false, ...over })
const show = (props = {}, c = cand()) => {
  const onPick = jest.fn()
  render(<EditionCard c={c} onPick={onPick} {...props} />)
  return onPick
}

describe("scoreTone", () => {
  it("is strong from 85, fair from 60, weak below", () => {
    expect([100, 86, STRONG_SCORE].map(scoreTone)).toEqual(["strong", "strong", "strong"])
    expect([84, 70, SHOW_SCORE_FROM].map(scoreTone)).toEqual(["fair", "fair", "fair"])
    expect([59, 30, 0].map(scoreTone)).toEqual(["weak", "weak", "weak"])
  })
})

describe("the match pill", () => {
  it("shows the percentage as a pill next to the title, not as small text after the id", () => {
    show({ score: 86 })
    const pill = screen.getByText("86%")
    expect(pill).toHaveAttribute("data-slot", "badge")
    expect(pill.parentElement).toContainElement(screen.getByText("How to Read a Book"))
    expect(screen.getByText("OL50213396M")).toBeInTheDocument()
    expect(screen.getByText("OL50213396M").textContent).not.toContain("%")
  })

  it.each([[90, "strong", "green"], [72, "fair", "amber"], [40, "weak", "muted"]])("colours a %s score as %s", (score, tone, colour) => {
    show({ score })
    const pill = screen.getByText(`${score}%`)
    expect(pill).toHaveAttribute("data-tone", tone)
    expect(pill.className).toContain(colour)
  })

  it("rounds the score and explains it in a tooltip", () => {
    show({ score: 85.6 })
    expect(screen.getByText("86%")).toHaveAttribute("title", "86% match")
  })

  it("shows no pill when there is no score", () => {
    show({ score: null })
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it("keeps a quiet note after the id, such as Top result", () => {
    show({ note: "Top result" })
    expect(screen.getByText("OL50213396M · Top result")).toBeInTheDocument()
  })

  it("still shows Already in your library and still picks on click", () => {
    const onPick = show({ score: 90 }, cand({ in_library: true }))
    expect(screen.getByText("Already in your library")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button"))
    expect(onPick).toHaveBeenCalledWith(50213396)
  })
})
