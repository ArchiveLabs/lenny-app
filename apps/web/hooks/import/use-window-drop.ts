"use client"

import { useEffect, useRef, useState } from "react"
import { collectDropped, type PickedFile } from "@/lib/import/walk"

const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")

/**
 * Makes the whole page a drop target. `dragging` is true while files are over the window.
 * A counter tracks dragenter/dragleave pairs so child elements do not flicker it.
 * preventDefault on dragover and drop stops the browser from opening the file instead.
 */
export function useWindowDrop(onFiles: (f: PickedFile[]) => void, onError: (message: string) => void, enabled = true) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const handlers = useRef({ onFiles, onError })
  handlers.current = { onFiles, onError }

  useEffect(() => {
    if (!enabled) return
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current++
      setDragging(true)
    }
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault() // required, or the browser rejects the drop and opens the file
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      // Must run in this tick: the item list is emptied once the handler returns.
      collectDropped(e.dataTransfer!.items).then(
        (files) =>
          files.length
            ? handlers.current.onFiles(files)
            : handlers.current.onError("No files found in what you dropped. Empty folders and hidden files are skipped."),
        (err) => handlers.current.onError(`Could not read the dropped folder: ${err instanceof Error ? err.message : String(err)}`),
      )
    }
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragover", over)
    window.addEventListener("dragleave", leave)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragover", over)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("drop", drop)
      depth.current = 0
    }
  }, [enabled])

  return dragging
}
