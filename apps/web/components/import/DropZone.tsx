"use client"

import { useRef } from "react"
import { FolderOpen, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { collectInput, type PickedFile } from "@/lib/import/walk"

export function DropZone({ onPick, compact, disabled }: { onPick: (f: PickedFile[]) => void; compact?: boolean; disabled?: boolean }) {
  const { t } = useTranslation()
  const folder = useRef<HTMLInputElement>(null)
  const many = useRef<HTMLInputElement>(null)

  const fromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onPick(collectInput(e.target.files))
    e.target.value = "" // allow picking the same folder again
  }

  return (
    <div
      data-testid="dropzone"
      className={`rounded-xl border-2 border-dashed border-border text-center ${compact ? "p-4 flex flex-wrap items-center justify-center gap-3" : "p-10 space-y-4"}`}
    >
      <Upload className={compact ? "h-5 w-5 text-muted-foreground" : "mx-auto h-10 w-10 text-muted-foreground"} aria-hidden />
      <div className={compact ? "text-sm text-muted-foreground" : "space-y-1"}>
        <p className={compact ? "" : "text-lg font-semibold"}>
          {compact ? t("Drop more EPUBs or a folder") : t("Drop a folder or EPUB files here")}
        </p>
        {!compact && <p className="text-sm text-muted-foreground">{t("EPUB only. Thousands at a time is fine.")}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" disabled={disabled} onClick={() => folder.current?.click()}>
          <FolderOpen className="mr-2 h-4 w-4" />
          {t("Choose a folder")}
        </Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => many.current?.click()}>
          {t("Choose files")}
        </Button>
      </div>
      <input
        ref={folder}
        type="file"
        hidden
        data-testid="folder-input"
        onChange={fromInput}
        // @ts-expect-error non-standard but supported by every current browser
        webkitdirectory=""
      />
      <input ref={many} type="file" hidden multiple accept=".epub,application/epub+zip" data-testid="files-input" onChange={fromInput} />
    </div>
  )
}
