"use client"

import { useState, useCallback, useRef, useSyncExternalStore } from "react"
import { invalidateLibraryCache } from "@/lib/query-client"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"

export type JobStatus = "queued" | "uploading" | "success" | "failed" | "cancelled"

export interface UploadJob {
  id: string
  editionKey: string
  title: string
  author: string
  coverUrl: string
  status: JobStatus
  error?: string
  startedAt?: number
  completedAt?: number
  encrypted: boolean
}

const STORAGE_KEY = "lenny-upload-jobs"

let memoryJobs: UploadJob[] = []
let initialized = false

function getSnapshot() {
  if (!initialized && typeof window !== "undefined") {
    try {
      memoryJobs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    } catch {
      memoryJobs = []
    }
    initialized = true
  }
  return memoryJobs
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      initialized = false // Force re-read
      getSnapshot()
      callback()
    }
  }
  
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageEvent)
  }
  
  return () => {
    listeners.delete(callback)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageEvent)
    }
  }
}

function persistJobs(jobs: UploadJob[]) {
  memoryJobs = jobs
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
  }
  listeners.forEach(l => l())
}

const EMPTY_JOBS: UploadJob[] = []
function getServerSnapshot() {
  return EMPTY_JOBS
}

export function useUploadJobs() {
  const jobs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [isUploading, setIsUploading] = useState(false)
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const startUpload = useCallback(async (
    books: { editionKey: string; title: string; author: string; coverUrl: string }[],
    attachments: Record<string, File>,
    encryptionMap: Record<string, boolean>,
    callbacks?: {
      onBookDone?: (editionKey: string) => void
    }
  ) => {
    cancelledRef.current = false

    // Create job entries for all books with attachments
    const newJobs: UploadJob[] = books
      .filter(b => attachments[b.editionKey])
      .map(b => ({
        id: `${b.editionKey}-${Date.now()}`,
        editionKey: b.editionKey,
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl,
        status: "queued" as JobStatus,
        encrypted: !!encryptionMap[b.editionKey],
        startedAt: Date.now(),
      }))

    if (newJobs.length === 0) return

    if (isUploading) {
      console.warn("Upload already in progress")
      return
    }

    // Prepend new jobs (latest first), keep up to 50 historical jobs
    const existing = getSnapshot().filter(j => j.status !== "queued" && j.status !== "uploading")
    const allJobs = [...newJobs, ...existing].slice(0, 50)
    persistJobs(allJobs)
    setIsUploading(true)

    // Process sequentially
    for (const job of newJobs) {
      if (cancelledRef.current) {
        // Mark remaining as cancelled
        const current = getSnapshot()
        const updated = current.map(j =>
          j.id === job.id && j.status === "queued"
            ? { ...j, status: "cancelled" as JobStatus, completedAt: Date.now() }
            : j
        )
        persistJobs(updated)
        continue
      }

      // Mark as uploading
      const currentJobs = getSnapshot()
      const updatedJobs = currentJobs.map(j =>
        j.id === job.id ? { ...j, status: "uploading" as JobStatus } : j
      )
      persistJobs(updatedJobs)
      setProcessingKey(job.editionKey)

      const file = attachments[job.editionKey]
      if (!file) {
        const afterJobs = getSnapshot()
        const failed = afterJobs.map(j =>
          j.id === job.id ? { ...j, status: "failed" as JobStatus, error: "File not found", completedAt: Date.now() } : j
        )
        persistJobs(failed)
        setProcessingKey(null)
        continue
      }

      const numericId = job.editionKey.replace(/\D/g, "")
      if (!numericId) {
        const afterJobs = getSnapshot()
        const failed = afterJobs.map(j =>
          j.id === job.id ? { ...j, status: "failed" as JobStatus, error: "Invalid edition key: no numeric ID found", completedAt: Date.now() } : j
        )
        persistJobs(failed)
        setProcessingKey(null)
        continue
      }
      const formData = new FormData()
      formData.append("file", file)
      formData.append("openlibrary_edition", numericId)
      formData.append("encrypted", job.encrypted ? "true" : "false")

      try {
        const response = await fetchAdmin("upload", {
          method: "POST",
          body: formData,
        })

        const afterJobs = getSnapshot()
        if (response.ok) {
          const done = afterJobs.map(j =>
            j.id === job.id ? { ...j, status: "success" as JobStatus, completedAt: Date.now() } : j
          )
          persistJobs(done)
          invalidateLibraryCache()
          callbacks?.onBookDone?.(job.editionKey)
        } else {
          const errText = await response.text().catch(() => "Unknown error")
          const failed = afterJobs.map(j =>
            j.id === job.id ? { ...j, status: "failed" as JobStatus, error: errText, completedAt: Date.now() } : j
          )
          persistJobs(failed)
        }
      } catch (error: any) {
        const afterJobs = getSnapshot()
        const failed = afterJobs.map(j =>
          j.id === job.id
            ? { ...j, status: "failed" as JobStatus, error: error?.message || "Network error", completedAt: Date.now() }
            : j
        )
        persistJobs(failed)
      } finally {
        setProcessingKey(null)
      }
    }

    setIsUploading(false)
  }, [isUploading])

  const cancelUpload = useCallback(() => {
    cancelledRef.current = true
    const current = getSnapshot()
    const updated = current.map(j =>
      j.status === "queued" ? { ...j, status: "cancelled" as JobStatus, completedAt: Date.now() } : j
    )
    persistJobs(updated)
  }, [])

  const clearJobs = useCallback(() => {
    persistJobs([])
  }, [])

  // Computed stats
  const stats = {
    queued: jobs.filter(j => j.status === "queued").length,
    uploading: jobs.filter(j => j.status === "uploading").length,
    success: jobs.filter(j => j.status === "success").length,
    failed: jobs.filter(j => j.status === "failed").length,
    cancelled: jobs.filter(j => j.status === "cancelled").length,
    total: jobs.length,
    active: jobs.filter(j => j.status === "queued" || j.status === "uploading").length,
  }

  return { jobs, stats, isUploading, processingKey, startUpload, cancelUpload, clearJobs }
}
