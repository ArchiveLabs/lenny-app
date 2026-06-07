import { useCallback, useSyncExternalStore } from "react"

export interface QueuedBook {
  editionKey: string
  title: string
  author: string
  year: string
  coverUrl: string
  addedAt: number
}

const QUEUE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const STORAGE_KEY = "lenny-book-queue"
const emptyQueue: QueuedBook[] = []

// Global memory cache to prevent parsing JSON on every render and ensure referential equality
let memoryCache: QueuedBook[] | null = null

function getSnapshot() {
  if (memoryCache !== null) return memoryCache

  if (typeof window === "undefined") {
    memoryCache = emptyQueue
    return memoryCache
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    memoryCache = emptyQueue
    return memoryCache
  }

  try {
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      console.warn("Invalid book queue data in localStorage")
      memoryCache = emptyQueue
      return memoryCache
    }
    
    const now = Date.now()
    const fresh = parsed.filter((b: QueuedBook) => now - b.addedAt < QUEUE_TTL_MS)
    
    if (fresh.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    }
    
    memoryCache = fresh
    return memoryCache
  } catch (e) {
    console.error("Failed to parse book queue from localStorage", e)
    memoryCache = emptyQueue
    return memoryCache
  }
}

function getServerSnapshot() {
  return emptyQueue
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  
  const handler = (e: Event) => {
    if (e.type === "storage" && (e as StorageEvent).key !== STORAGE_KEY) return
    memoryCache = null // Invalidate cache so getSnapshot re-reads from storage
    callback()
  }
  
  window.addEventListener("book-queue-updated", handler)
  window.addEventListener("storage", handler)
  
  return () => {
    window.removeEventListener("book-queue-updated", handler)
    window.removeEventListener("storage", handler)
  }
}

export function useBookQueue() {
  const queue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addBook = useCallback((book: QueuedBook) => {
    const current = getSnapshot()
    if (current.find(b => b.editionKey === book.editionKey)) return
    
    const newQueue = [...current, book]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue))
    memoryCache = newQueue // Optimistically update cache
    window.dispatchEvent(new Event("book-queue-updated"))
  }, [])

  const removeBook = useCallback((editionKey: string) => {
    const current = getSnapshot()
    const newQueue = current.filter(b => b.editionKey !== editionKey)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue))
    memoryCache = newQueue // Optimistically update cache
    window.dispatchEvent(new Event("book-queue-updated"))
  }, [])

  const clearQueue = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    memoryCache = emptyQueue // Optimistically update cache
    window.dispatchEvent(new Event("book-queue-updated"))
  }, [])

  return { queue, addBook, removeBook, clearQueue }
}
