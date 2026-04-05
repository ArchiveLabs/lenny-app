"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { invalidateLibraryCache } from "@/lib/query-client"

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
const EVENT_KEY = "upload-jobs-updated"

function loadJobs(): UploadJob[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

function persistJobs(jobs: UploadJob[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
  window.dispatchEvent(new Event(EVENT_KEY))
}

function getUploadUrl(): string {
  const envApi = process.env.NEXT_PUBLIC_API_URL
  let apiBase = "http://localhost:8080"
  if (envApi) {
    const isInternalDockerHost = envApi.includes("lenny_api") || envApi.includes("127.0.0.1")
    if (!isInternalDockerHost) {
      apiBase = envApi
    } else if (typeof window !== "undefined") {
      apiBase = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:8080" : window.location.origin
    }
  } else if (typeof window !== "undefined") {
    apiBase = window.location.origin
  }
  if (typeof window !== "undefined" && apiBase === window.location.origin) {
    return "/v1/api/upload"
  }
  return `${apiBase}/v1/api/upload`
}

export function useUploadJobs() {
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  // Load on mount
  useEffect(() => {
    setJobs(loadJobs())
  }, [])

  // Sync across components
  useEffect(() => {
    const handleSync = () => setJobs(loadJobs())
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) handleSync()
    }
    window.addEventListener(EVENT_KEY, handleSync)
    window.addEventListener("storage", handleStorageEvent)
    return () => {
      window.removeEventListener(EVENT_KEY, handleSync)
      window.removeEventListener("storage", handleStorageEvent)
    }
  }, [])

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
    const existing = loadJobs().filter(j => j.status !== "queued" && j.status !== "uploading")
    const allJobs = [...newJobs, ...existing].slice(0, 50)
    persistJobs(allJobs)
    setJobs(allJobs)
    setIsUploading(true)

    // Process sequentially
    for (const job of newJobs) {
      if (cancelledRef.current) {
        // Mark remaining as cancelled
        const current = loadJobs()
        const updated = current.map(j =>
          j.id === job.id && j.status === "queued"
            ? { ...j, status: "cancelled" as JobStatus, completedAt: Date.now() }
            : j
        )
        persistJobs(updated)
        continue
      }

      // Mark as uploading
      const currentJobs = loadJobs()
      const updatedJobs = currentJobs.map(j =>
        j.id === job.id ? { ...j, status: "uploading" as JobStatus } : j
      )
      persistJobs(updatedJobs)
      setJobs(updatedJobs)
      setProcessingKey(job.editionKey)

      const file = attachments[job.editionKey]
      if (!file) {
        const afterJobs = loadJobs()
        const failed = afterJobs.map(j =>
          j.id === job.id ? { ...j, status: "failed" as JobStatus, error: "File not found", completedAt: Date.now() } : j
        )
        persistJobs(failed)
        setJobs(failed)
        setProcessingKey(null)
        continue
      }

      const numericId = job.editionKey.replace(/\D/g, "")
      if (!numericId) {
        const afterJobs = loadJobs()
        const failed = afterJobs.map(j =>
          j.id === job.id ? { ...j, status: "failed" as JobStatus, error: "Invalid edition key: no numeric ID found", completedAt: Date.now() } : j
        )
        persistJobs(failed)
        setJobs(failed)
        setProcessingKey(null)
        continue
      }
      const formData = new FormData()
      formData.append("file", file)
      formData.append("openlibrary_edition", numericId)
      formData.append("encrypted", job.encrypted ? "true" : "false")

      try {
        const response = await fetch(getUploadUrl(), {
          method: "POST",
          body: formData,
        })

        const afterJobs = loadJobs()
        if (response.ok) {
          const done = afterJobs.map(j =>
            j.id === job.id ? { ...j, status: "success" as JobStatus, completedAt: Date.now() } : j
          )
          persistJobs(done)
          setJobs(done)
          invalidateLibraryCache()
          callbacks?.onBookDone?.(job.editionKey)
        } else {
          const errText = await response.text().catch(() => "Unknown error")
          const failed = afterJobs.map(j =>
            j.id === job.id ? { ...j, status: "failed" as JobStatus, error: errText, completedAt: Date.now() } : j
          )
          persistJobs(failed)
          setJobs(failed)
        }
      } catch (error: any) {
        const afterJobs = loadJobs()
        const failed = afterJobs.map(j =>
          j.id === job.id
            ? { ...j, status: "failed" as JobStatus, error: error?.message || "Network error", completedAt: Date.now() }
            : j
        )
        persistJobs(failed)
        setJobs(failed)
      } finally {
        setProcessingKey(null)
      }
    }

    setIsUploading(false)
  }, [])

  const cancelUpload = useCallback(() => {
    cancelledRef.current = true
    const current = loadJobs()
    const updated = current.map(j =>
      j.status === "queued" ? { ...j, status: "cancelled" as JobStatus, completedAt: Date.now() } : j
    )
    persistJobs(updated)
    setJobs(updated)
  }, [])

  const clearJobs = useCallback(() => {
    persistJobs([])
    setJobs([])
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
