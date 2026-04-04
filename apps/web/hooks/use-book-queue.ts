import { useState, useEffect, useCallback } from "react"

export interface QueuedBook {
  editionKey: string
  title: string
  author: string
  year: string
  coverUrl: string
  addedAt: number
}

const QUEUE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export function useBookQueue() {
  const [queue, setQueue] = useState<QueuedBook[]>([])
  
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = localStorage.getItem("lenny-book-queue")
    if (stored) {
      try {
        const parsed: QueuedBook[] = JSON.parse(stored)
        if (!Array.isArray(parsed)) {
          console.warn("Invalid book queue data in localStorage")
          return
        }
        const now = Date.now()
        const fresh = parsed.filter(b => now - b.addedAt < QUEUE_TTL_MS)
        // If expired items were pruned, update storage
        if (fresh.length !== parsed.length) {
          localStorage.setItem("lenny-book-queue", JSON.stringify(fresh))
        }
        setQueue(fresh)
      } catch (e) {
        console.error("Failed to parse book queue from localStorage", e)
      }
    }
  }, [])

  const addBook = useCallback((book: QueuedBook) => {
    setQueue(prev => {
      if (prev.find(b => b.editionKey === book.editionKey)) return prev
      const newQueue = [...prev, book]
      localStorage.setItem("lenny-book-queue", JSON.stringify(newQueue))
      window.dispatchEvent(new Event("book-queue-updated"))
      return newQueue
    })
  }, [])

  const removeBook = useCallback((editionKey: string) => {
    setQueue(prev => {
      const newQueue = prev.filter(b => b.editionKey !== editionKey)
      localStorage.setItem("lenny-book-queue", JSON.stringify(newQueue))
      window.dispatchEvent(new Event("book-queue-updated"))
      return newQueue
    })
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
    localStorage.removeItem("lenny-book-queue")
    window.dispatchEvent(new Event("book-queue-updated"))
  }, [])

  useEffect(() => {
    const handleSync = () => {
      const stored = localStorage.getItem("lenny-book-queue")
      if (stored) {
        try {
          setQueue(JSON.parse(stored))
        } catch (e) {
          console.error("Failed to parse book queue on sync", e)
        }
      } else {
        setQueue([])
      }
    }
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "lenny-book-queue") handleSync()
    }
    window.addEventListener("book-queue-updated", handleSync)
    window.addEventListener("storage", handleStorageEvent)
    return () => {
      window.removeEventListener("book-queue-updated", handleSync)
      window.removeEventListener("storage", handleStorageEvent)
    }
  }, [])

  return { queue, addBook, removeBook, clearQueue }
}
