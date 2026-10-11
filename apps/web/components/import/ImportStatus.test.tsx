// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { ImportStatus } from "./ImportStatus"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const job = (over = {}) => ({ id: "j", status: "done", total: 5000, done: 5000, imported: 4985, duplicate: 12, failed: 3, waiting: 0, error: null, ...over })
const summary = (over = {}) => ({ id: 1, created_at: "", expires_at: "", total: 5000, counts: {}, skipped: 0, encrypted: 0, ready: 0, auto_picked: 0, staged: 0, unstaged: 0, import: null, ...over })
const show = (s) => {
  const fns = { onShowFailed: jest.fn(), onRetryFailed: jest.fn(), onStartAgain: jest.fn() }
  render(<ImportStatus summary={s} {...fns} />)
  return fns
}

it("shows nothing before the first import", () => {
  const { container } = render(<ImportStatus summary={summary()} onShowFailed={jest.fn()} onRetryFailed={jest.fn()} onStartAgain={jest.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

describe("running", () => {
  it("shows Importing N of M from the job, with a progress bar", () => {
    show(summary({ import: job({ status: "running", done: 1240, total: 5000 }) }))
    expect(screen.getByText("Importing 1,240 of 5,000")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Import progress" })).toHaveAttribute("aria-valuenow", "25")
  })

  it("says the page can be left", () => {
    show(summary({ import: job({ status: "running", done: 1, total: 5 }) }))
    expect(screen.getByText("You can leave this page. The import continues on the server.")).toBeInTheDocument()
  })

  it("treats a queued job as running", () => {
    show(summary({ import: job({ status: "queued", done: 0, total: 10 }) }))
    expect(screen.getByText("Importing 0 of 10")).toBeInTheDocument()
  })

  it("falls back to the row counts when there is no job (server restarted)", () => {
    show(summary({ counts: { importing: 30, imported: 70 } }))
    expect(screen.getByText("Importing 70 of 100")).toBeInTheDocument()
  })
})

describe("done", () => {
  it("summarises imported, already-in-library and failed", () => {
    show(summary({ import: job() }))
    expect(screen.getByText("4,985 imported. 12 were already in your library. 3 failed.")).toBeInTheDocument()
  })

  it("leaves out the parts that are zero", () => {
    show(summary({ import: job({ imported: 5000, duplicate: 0, failed: 0 }) }))
    expect(screen.getByText("5,000 imported.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Show failed" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry failed" })).not.toBeInTheDocument()
  })

  it("links to the Library", () => {
    show(summary({ import: job() }))
    expect(screen.getByRole("link", { name: "View in Library" })).toHaveAttribute("href", "/library")
  })

  it("offers Show failed and Retry failed when some failed", () => {
    const { onShowFailed, onRetryFailed } = show(summary({ import: job() }))
    fireEvent.click(screen.getByRole("button", { name: "Show failed" }))
    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }))
    expect(onShowFailed).toHaveBeenCalled()
    expect(onRetryFailed).toHaveBeenCalled()
  })

  it("says how many are still waiting for their files", () => {
    show(summary({ import: job({ waiting: 40 }) }))
    expect(screen.getByText("40 books are still waiting for their files. Drop the folder again to finish them.")).toBeInTheDocument()
  })

  it("does not mention waiting when none are", () => {
    show(summary({ import: job() }))
    expect(screen.queryByText(/still waiting/)).not.toBeInTheDocument()
  })

  it("says nothing for a job that had nothing to do", () => {
    const { container } = render(<ImportStatus summary={summary({ import: job({ total: 0, imported: 0, duplicate: 0, failed: 0 }) })} onShowFailed={jest.fn()} onRetryFailed={jest.fn()} onStartAgain={jest.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("failed job", () => {
  it("shows the error with Start again", () => {
    const { onStartAgain } = show(summary({ import: job({ status: "failed", error: "Storage is unreachable" }) }))
    expect(screen.getByRole("alert")).toHaveTextContent("The import stopped. Storage is unreachable")
    fireEvent.click(screen.getByRole("button", { name: "Start again" }))
    expect(onStartAgain).toHaveBeenCalled()
  })
})

it("disables the retry buttons while disabled", () => {
  render(<ImportStatus summary={summary({ import: job() })} disabled onShowFailed={jest.fn()} onRetryFailed={jest.fn()} onStartAgain={jest.fn()} />)
  expect(screen.getByRole("button", { name: "Retry failed" })).toBeDisabled()
})

it("offers View history when the result is shown and a handler is given", () => {
  const onViewHistory = jest.fn()
  render(<ImportStatus summary={summary({ import: job() })} onShowFailed={jest.fn()} onRetryFailed={jest.fn()} onStartAgain={jest.fn()} onViewHistory={onViewHistory} />)
  fireEvent.click(screen.getByRole("button", { name: "View history" }))
  expect(onViewHistory).toHaveBeenCalled()
})

describe("dismissing the result", () => {
  it("puts the result away", () => {
    show(summary({ import: job() }))
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText(/imported\./)).not.toBeInTheDocument()
  })

  it("shows the next import's result again", () => {
    const { rerender } = render(<ImportStatus summary={summary({ import: job({ id: "a" }) })} onShowFailed={jest.fn()} onRetryFailed={jest.fn()} onStartAgain={jest.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    rerender(<ImportStatus summary={summary({ import: job({ id: "a" }) })} onShowFailed={jest.fn()} onRetryFailed={jest.fn()} onStartAgain={jest.fn()} />)
    expect(screen.queryByText(/imported\./)).not.toBeInTheDocument()
    rerender(<ImportStatus summary={summary({ import: job({ id: "b", imported: 7 }) })} onShowFailed={jest.fn()} onRetryFailed={jest.fn()} onStartAgain={jest.fn()} />)
    expect(screen.getByText(/7 imported\./)).toBeInTheDocument()
  })

  it("does not offer to dismiss a running import", () => {
    show(summary({ import: job({ status: "running" }) }))
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument()
  })
})
