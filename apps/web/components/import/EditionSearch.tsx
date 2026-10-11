"use client"

import { forwardRef, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { importApi } from "@/lib/import/api"
import type { ImportRow } from "@/types/import"
import { EditionCard, SHOW_SCORE_FROM } from "./EditionCard"
import { EditionError } from "./EditionError"

export const ADD_ON_OPEN_LIBRARY_URL = "https://openlibrary.org/books/add"
const MIN_CHARS = 2 // the server refuses less
const DEBOUNCE_MS = 400

/** Search box for the edition panel: words, ISBN, OL key or link. Pass a new `key` per row to reset it. */
export const EditionSearch = forwardRef<HTMLInputElement, { batchId: number; row: ImportRow; onPick: (olid: number) => void; onStartOver: () => void }>(
  function EditionSearch({ batchId, row, onPick, onStartOver }, inputRef) {
    const { t } = useTranslation()
    const [text, setText] = useState("")
    const [q, setQ] = useState("") // what is actually searched
    const [active, setActive] = useState(-1)

    useEffect(() => {
      const next = text.trim()
      const timer = setTimeout(() => setQ(next), DEBOUNCE_MS)
      return () => clearTimeout(timer)
    }, [text])

    const enabled = q.length >= MIN_CHARS
    // A new q is a new key, so a slow answer to an old search is never shown.
    const search = useQuery({
      queryKey: ["import-search", batchId, row.id, q],
      queryFn: () => importApi.searchEditions(batchId, row.id, q),
      enabled,
      staleTime: 0, // each search is live
      gcTime: 0,
      retry: false,
    })
    const results = enabled ? (search.data?.candidates ?? []) : []
    const anyStrong = results.some((c) => (c.score ?? 0) >= SHOW_SCORE_FROM)
    const note = (c: (typeof results)[number], i: number) =>
      (c.score ?? 0) >= SHOW_SCORE_FROM ? `${Math.round(c.score!)}%` : i === 0 && !anyStrong ? t("Top result") : undefined

    useEffect(() => setActive(-1), [q])

    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!results.length) return
        e.preventDefault()
        setActive((a) => (e.key === "ArrowDown" ? Math.min(a + 1, results.length - 1) : Math.max(a - 1, 0)))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const chosen = results[active]
        if (chosen) onPick(chosen.olid)
        else setQ(text.trim()) // search now, without waiting for the pause
      }
    }

    return (
      <section className="space-y-2">
        <Label htmlFor="edition-search">{t("Search Open Library")}</Label>
        <div className="relative">
          <Input
            id="edition-search"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("Title, author, ISBN or OL123456M")}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="edition-results"
            aria-activedescendant={active >= 0 ? `edition-result-${active}` : undefined}
          />
          {search.isFetching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" aria-label={t("Searching")} />}
        </div>
        {text.trim().length > 0 && text.trim().length < MIN_CHARS && (
          <p className="text-xs text-muted-foreground">{t("Type at least 2 characters.")}</p>
        )}

        <div aria-live="polite" className="space-y-2">
          {search.isError && <EditionError error={search.error} onRetry={() => search.refetch()} onStartOver={onStartOver} />}
          {enabled && search.isSuccess && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("No editions found.")}{" "}
              <a href={ADD_ON_OPEN_LIBRARY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
                {t("Not listed? Add it on Open Library")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </p>
          )}
          <ul id="edition-results" role="listbox" className="space-y-2">
            {results.map((c, i) => (
              <li key={c.olid} role="presentation">
                <EditionCard c={c} id={`edition-result-${i}`} active={i === active} selected={row.olid === c.olid} note={note(c, i)} onPick={onPick} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    )
  },
)
