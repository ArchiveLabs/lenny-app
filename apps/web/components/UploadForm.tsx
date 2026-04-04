"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { UploadCloud, Loader2, FileType, Search, Shield, ShieldAlert, X, Trash2, Layers, Plus } from "lucide-react"
import { useUploadJobs } from "@/hooks/use-upload-jobs"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import Link from "next/link"
import { useBookQueue } from "../hooks/use-book-queue"

type UploadStatus = "idle" | "uploading" | "success" | "error" | "conflict" | "partial"

// ── Module-level persistence ──
// File objects can't be serialized, so we hold them in memory.
// This survives client-side SPA navigation but not hard page refreshes (which is expected).
const persistedAttachments: Record<string, File> = {}

function getPersistedEncryptionMap(): Record<string, boolean> {
    if (typeof window === "undefined") return {}
    try { return JSON.parse(localStorage.getItem("lenny-encryption-map") || "{}") } catch { return {} }
}
function savePersistedEncryptionMap(map: Record<string, boolean>) {
    try { localStorage.setItem("lenny-encryption-map", JSON.stringify(map)) } catch { /* quota or private browsing */ }
}

export default function UploadForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { queue, removeBook, addBook } = useBookQueue()
    
    // Manual upload state
    const urlEdition = searchParams?.get("edition") || ""
    const [manualEdition, setManualEdition] = useState(urlEdition)
    
    // Batch upload state – initialized from persistence
    const [attachments, setAttachments] = useState<Record<string, File>>(() => ({ ...persistedAttachments }))
    const [encryptionMap, setEncryptionMap] = useState<Record<string, boolean>>(() => getPersistedEncryptionMap())
    const [selectedRows, setSelectedRows] = useState<string[]>([])
    const [mounted, setMounted] = useState(false)
    const { startUpload, isUploading, processingKey } = useUploadJobs()

    useEffect(() => {
        setMounted(true)
    }, [])

    // Sync attachments to module-level store on every change
    useEffect(() => {
        // Clear old keys and set current ones
        Object.keys(persistedAttachments).forEach(k => { if (!(k in attachments)) delete persistedAttachments[k] })
        Object.entries(attachments).forEach(([k, v]) => { persistedAttachments[k] = v })
    }, [attachments])

    // Sync encryptionMap to localStorage on every change
    useEffect(() => {
        savePersistedEncryptionMap(encryptionMap)
    }, [encryptionMap])

    useEffect(() => {
        if (urlEdition && urlEdition !== manualEdition) {
            setManualEdition(urlEdition)
            router.replace('/', { scroll: false })
        }
    }, [urlEdition, manualEdition, router])

    const [manualError, setManualError] = useState("")
    const [isAddingManual, setIsAddingManual] = useState(false)

    const handleAddManual = async (e: React.FormEvent) => {
        e.preventDefault()
        setManualError("")
        if (!manualEdition.trim()) return;
        const normalized = manualEdition.trim().toUpperCase() // Edition IDs are typically uppercase
        setIsAddingManual(true)
        
        try {
            const res = await fetch(`https://openlibrary.org/api/books?bibkeys=OLID:${encodeURIComponent(normalized)}&format=json&jscmd=data`)
            const data = await res.json()
            const bookData = data[`OLID:${normalized}`]
            
            if (!bookData) {
                setManualError(`Edition not found in Open Library.`)
                return
            }
            
            const title = bookData.title || `Manual Entry: ${normalized}`
            const author = bookData.authors && bookData.authors.length > 0 ? bookData.authors.map((a: any) => a.name).join(", ") : "Unknown Author"
            const year = bookData.publish_date || "Unknown"
            const coverUrl = bookData.cover?.medium || ""
            
            addBook({
                editionKey: normalized,
                title,
                author,
                year,
                coverUrl,
                addedAt: Date.now()
            })
            setManualEdition("");
        } catch (err) {
            setManualError("Failed to verify edition ID.")
        } finally {
            setIsAddingManual(false)
        }
    }

    const handleAttachmentChange = (editionKey: string, attachedFile: File) => {
        setAttachments(prev => ({ ...prev, [editionKey]: attachedFile }))
    }

    const removeAttachment = (editionKey: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setAttachments(prev => { const next = { ...prev }; delete next[editionKey]; return next })
    }

    // ── Upload via job tracker ──
    const handleUpload = async () => {
        const targetKeys = Object.keys(attachments)
        if (targetKeys.length === 0) return

        const booksToUpload = queue.filter(b => attachments[b.editionKey])
        await startUpload(booksToUpload, attachments, encryptionMap, {
            onBookDone: (editionKey) => {
                removeBook(editionKey)
                setAttachments(prev => { const next = { ...prev }; delete next[editionKey]; return next })
            }
        })
        router.push("/processing")
    }

    const attachedCount = Object.keys(attachments).length

    // ═══════════════════════════════════════════════
    // RENDER: Unified Queue Mode
    // ═══════════════════════════════════════════════

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 space-y-10 p-2 md:p-6 lg:p-8">
            {/* Page Header */}
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Upload EPUB</h2>
                <p className="text-muted-foreground text-base max-w-2xl">
                    Attach files to your queued books and process them in batch. Each book can be individually configured with encryption settings.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 pb-10">
                {/* ── Left: Queue Table ── */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Table Header Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Layers className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <Label className="text-base font-semibold">Processing Queue</Label>
                                <p className="text-sm text-muted-foreground">{queue.length} book{queue.length !== 1 && "s"} ready</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            {selectedRows.length > 0 && (
                                <Button 
                                    variant="destructive" size="sm" className="h-9 font-semibold rounded-lg animate-in fade-in zoom-in-95 duration-200" 
                                    onClick={() => { selectedRows.forEach(id => removeBook(id)); setSelectedRows([]) }}
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                    Remove {selectedRows.length}
                                </Button>
                            )}
                            <div className="flex flex-col relative">
                                <form onSubmit={handleAddManual} className="flex relative">
                                    <Input 
                                        className={`h-9 pr-9 w-[180px] lg:w-[220px] rounded-lg border-dashed transition-colors bg-muted/20 ${manualError ? "border-red-500 hover:border-red-500 focus-visible:ring-red-500/30" : "hover:border-primary/50"}`} 
                                        placeholder="Add Edition manually..." 
                                        value={manualEdition}
                                        onChange={e => { setManualEdition(e.target.value); setManualError(""); }}
                                        disabled={isAddingManual}
                                    />
                                    <Button type="submit" size="icon" variant="ghost" disabled={isAddingManual} className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent">
                                        {isAddingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    </Button>
                                </form>
                                {manualError && (
                                    <span className="absolute -bottom-5 right-0 text-[10px] text-red-500 font-medium whitespace-nowrap">{manualError}</span>
                                )}
                            </div>
                            <Button variant="outline" size="sm" asChild className="h-9 rounded-lg font-semibold border-dashed">
                                <Link href="/add-book" className="flex items-center gap-1.5 px-3">
                                    <Search className="w-4 h-4" />
                                    Search & Add Books
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* The Table */}
                    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                        <Table className="table-fixed">
                                <colgroup>
                                    <col className="w-[50px]" />
                                    <col />
                                    <col className="w-[160px]" />
                                    <col className="w-[100px]" />
                                    <col className="w-[120px]" />
                                </colgroup>
                                <TableHeader className="bg-muted/50 border-b">
                                    <TableRow className="hover:bg-transparent cursor-default">
                                        <TableHead className="text-center pl-4">
                                            <Checkbox 
                                                checked={queue.length > 0 && selectedRows.length === queue.length}
                                                onCheckedChange={(c) => setSelectedRows(c ? queue.map(b => b.editionKey) : [])}
                                            />
                                        </TableHead>
                                        <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Book</TableHead>
                                        <TableHead className="hidden lg:table-cell font-semibold text-muted-foreground text-xs uppercase tracking-wider">Edition</TableHead>
                                        <TableHead className="hidden md:table-cell text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">Encrypt</TableHead>
                                        <TableHead className="text-right pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">File</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {queue.length === 0 && (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={5} className="py-24 text-center whitespace-normal">
                                                <div className="flex flex-col items-center justify-center space-y-4">
                                                    <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-2">
                                                        <Search className="w-8 h-8 text-muted-foreground/40" />
                                                    </div>
                                                    <h3 className="text-lg font-semibold">Queue is empty</h3>
                                                    <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed mx-auto">
                                                        Search the Open Library Registry or manually input an Edition ID above to begin mapping your uploads.
                                                    </p>
                                                    <Button variant="secondary" className="mt-4 font-semibold" asChild>
                                                        <Link href="/add-book">
                                                            <Search className="w-4 h-4 mr-2" />
                                                            Search & Add Books
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {queue.map(book => {
                                        const att = attachments[book.editionKey]
                                        const isPr = processingKey === book.editionKey
                                        const isSel = selectedRows.includes(book.editionKey)
                                        
                                        let cls = "border-l-2 border-l-transparent hover:bg-muted/30"
                                        if (isPr) cls = "bg-blue-500/5 hover:bg-blue-500/10 border-l-2 border-l-blue-500"
                                        else if (att) cls = "bg-green-500/5 hover:bg-green-500/10 border-l-2 border-l-green-500"

                                        return (
                                            <TableRow key={book.editionKey} className={`group transition-colors duration-200 ${cls}`}>
                                                <TableCell className="text-center pl-4">
                                                    <Checkbox checked={isSel} onCheckedChange={(c) => setSelectedRows(p => c ? [...p, book.editionKey] : p.filter(k => k !== book.editionKey))} />
                                                </TableCell>
                                                <TableCell className="py-3 max-w-[180px] sm:max-w-[280px] lg:max-w-[380px] whitespace-normal">
                                                    <div className="flex items-center gap-3 w-full min-w-0">
                                                        {book.coverUrl ? (
                                                            <img src={book.coverUrl} className="h-[42px] w-[29px] shrink-0 object-cover rounded shadow-sm hidden sm:block border" alt={`${book.title} cover`} />
                                                        ) : (
                                                            <div className="h-[42px] w-[29px] shrink-0 rounded bg-muted/60 hidden sm:flex items-center justify-center border">
                                                                <FileType className="h-3 w-3 text-muted-foreground/40" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <span className="text-[13px] leading-snug truncate font-semibold text-foreground/90" title={book.title}>{book.title}</span>
                                                            <span className="text-muted-foreground font-normal text-[11px] mt-0.5 truncate">{book.author}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell align-middle">
                                                    <span className="font-mono text-[10px] tracking-wider uppercase font-bold bg-muted px-2 py-1 rounded text-muted-foreground">{book.editionKey}</span>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-center">
                                                    <Button 
                                                        variant="outline" size="sm"
                                                        onClick={() => setEncryptionMap(p => ({...p, [book.editionKey]: !p[book.editionKey]}))}
                                                        className={`h-7 px-2 rounded transition-all text-[10px] font-bold uppercase tracking-wider ${encryptionMap[book.editionKey] ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400" : "text-muted-foreground border-muted-foreground/20 hover:text-foreground"}`}
                                                    >
                                                        {encryptionMap[book.editionKey] ? <Shield className="h-3 w-3 mr-1" /> : <ShieldAlert className="h-3 w-3 mr-1 opacity-60" />}
                                                        {encryptionMap[book.editionKey] ? "On" : "Off"}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-right pr-4">
                                                    {isPr ? (
                                                        <span className="text-blue-600 text-xs font-medium animate-pulse flex items-center justify-end gap-1.5">
                                                            <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                                                        </span>
                                                    ) : att ? (
                                                        <div className="flex items-center justify-end gap-1 text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 py-1 pl-2 pr-0.5 rounded-lg ml-auto max-w-fit">
                                                            <FileType className="w-3 h-3 shrink-0 opacity-70" />
                                                            <span className="text-[10px] font-semibold truncate max-w-[70px]">{att.name}</span>
                                                            <Button variant="ghost" className="h-5 w-5 p-0 rounded shrink-0 hover:text-red-600 transition-colors" onClick={(e) => removeAttachment(book.editionKey, e)}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="relative inline-flex ml-auto">
                                                            <Input type="file" accept=".epub" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                                onChange={(e) => { if (e.target.files?.[0]) handleAttachmentChange(book.editionKey, e.target.files[0]); e.target.value = '' }}
                                                            />
                                                            <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold relative z-10 px-3 group-hover:border-primary/50 group-hover:bg-primary/5 transition-all">
                                                                <UploadCloud className="w-3 h-3 mr-1.5 opacity-70" /> Attach
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* ── Right: Actions Panel ── */}
                    <div className="xl:col-span-1 xl:pl-8 space-y-8 xl:border-l border-border mt-8 xl:mt-0">
                      <div className="xl:sticky xl:top-8 space-y-8">
                        {/* Summary */}
                        <div className="space-y-5">
                            <Label className="text-base font-semibold">Book's Queue Overview</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
                                    <p className="text-3xl font-bold text-primary">{queue.length}</p>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">Total Books</p>
                                </div>
                                <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
                                    <p className={`text-3xl font-bold ${attachedCount > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>{attachedCount}</p>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">Files Attached</p>
                                </div>
                            </div>
                            {attachedCount < queue.length && attachedCount > 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    {queue.length - attachedCount} book{queue.length - attachedCount !== 1 ? "s" : ""} still need a file attached
                                </p>
                            )}
                        </div>

                        {/* Encryption Info */}
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">Encryption</Label>
                            <div className="rounded-xl border border-muted-foreground/20 p-5 bg-muted/5 space-y-3">
                                <div className="flex items-center gap-2.5">
                                    <Shield className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-semibold">Per-Book Control</span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Toggle encryption individually for each book using the <b>Encrypt</b> column in the table. Enabled books will be secured with OAuth before Borrowing.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-xs text-muted-foreground">{mounted ? Object.values(encryptionMap).filter(Boolean).length : 0} of {queue.length} encrypted</span>
                                </div>
                            </div>
                        </div>

                        {/* Execute */}
                        <div className="space-y-5 pt-6 xl:border-t border-border">
                            <div className="space-y-1.5">
                                <h3 className="text-base font-semibold">{attachedCount <= 1 ? "Upload" : "Batch Upload"}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {attachedCount <= 1
                                        ? "Upload the attached file to the Lenny server."
                                        : "Sequentially uploads all attached files. Books without files are skipped."}
                                </p>
                            </div>
                            <Button 
                                size="lg"
                                onClick={handleUpload} 
                                disabled={isUploading || attachedCount === 0}
                                className="w-full h-14 text-base font-bold shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                        Uploading…
                                    </>
                                ) : attachedCount > 0 ? (
                                    <>
                                        <UploadCloud className="mr-2 h-5 w-5" />
                                        Upload {attachedCount} File{attachedCount !== 1 ? "s" : ""}
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="mr-2 h-5 w-5" />
                                        Upload Books
                                    </>
                                )}
                            </Button>
                        </div>
                      </div>
                    </div>
                </div>
            </div>
        )
}