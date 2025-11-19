"use client"
import { useState } from "react"
import axios from "axios"
import { UploadIcon, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"

type UploadStatus = "idle" | "uploading" | "success" | "error" | "conflict"

export default function UploadForm() {
    const [editionId, setEditionId] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [encryption, setEncryption] = useState("no")
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
    const [statusMessage, setStatusMessage] = useState("")

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) {
            setUploadStatus("error")
            setStatusMessage("Please select a file")
            return
        }

        if (!editionId) {
            setUploadStatus("error")
            setStatusMessage("Please enter an Open Library Edition ID")
            return
        }

        const numericId = editionId.replace(/\D/g, "")
        if (!numericId || isNaN(Number(numericId))) {
            setUploadStatus("error")
            setStatusMessage("Please enter a valid Open Library Edition ID (e.g., OL60638966M)")
            return
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("openlibrary_edition", numericId)
        formData.append("encrypted", encryption === "yes" ? "true" : "false")

        setUploadStatus("uploading")
        setStatusMessage("Uploading file to server...")
        try {
            // Resolve API base URL for the browser.
            // NOTE: when the frontend is built inside Docker we may have NEXT_PUBLIC_API_URL set to
            // an internal Docker hostname (eg. http://lenny_api:80) which is not reachable from the user's
            // browser. Prefer these strategies in order:
            // 1. If NEXT_PUBLIC_API_URL is set and doesn't look like an internal Docker hostname, use it.
            // 2. If NEXT_PUBLIC_API_URL points to an internal Docker hostname (contains "lenny_api"),
            //    and we're running in the browser on localhost, use http://localhost:8080.
            // 3. Otherwise use the current origin (window.location.origin) and post to a relative path
            //    so a reverse-proxy (nginx) can forward the request to the API.
            const envApi = process.env.NEXT_PUBLIC_API_URL
            let apiBase = "http://localhost:8080"
            if (envApi) {
                const isInternalDockerHost = envApi.includes("lenny_api") || envApi.includes("127.0.0.1")
                if (!isInternalDockerHost) {
                    apiBase = envApi
                } else if (typeof window !== "undefined") {
                    // If user is running the browser on localhost, call the mapped host port.
                    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
                        apiBase = "http://localhost:8080"
                    } else {
                        // If the site is served from a host (not localhost), use relative path so the
                        // front-facing proxy can route to the API container.
                        apiBase = window.location.origin
                    }
                }
            } else if (typeof window !== "undefined") {
                apiBase = window.location.origin
            }

            const uploadUrl = apiBase === window.location.origin ? "/v1/api/upload" : `${apiBase}/v1/api/upload`

            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            })
            
            // Check if response is successful (status 200)
            if (response.status === 200) {
                setUploadStatus("success")
                setStatusMessage("File uploaded successfully! Processing complete.")
                
                // Reset form after 3 seconds
                setTimeout(() => {
                    setEditionId("")
                    setFile(null)
                    setEncryption("no")
                    setUploadStatus("idle")
                    setStatusMessage("")
                    // Clear file input
                    const fileInput = document.getElementById("file") as HTMLInputElement
                    if (fileInput) fileInput.value = ""
                }, 3000)
            }
        } catch (error) {
            // Log full error for debugging (network / CORS / response body)
            console.error("Error uploading file (detailed):", error)

            if (axios.isAxiosError(error) && error.response) {
                const status = error.response.status
                
                if (status === 409) {
                    setUploadStatus("conflict")
                    setStatusMessage("This file already exists on the server. Edition ID already has content.")
                } else if (status === 413) {
                    setUploadStatus("error")
                    setStatusMessage("File is too large. Maximum size is 50MB.")
                } else if (status === 503) {
                    setUploadStatus("error")
                    setStatusMessage("Uploader not allowed. Check your IP permissions.")
                } else if (status === 400) {
                    setUploadStatus("error")
                    setStatusMessage("Invalid file. Please upload a valid EPUB or PDF.")
                } else {
                    setUploadStatus("error")
                    setStatusMessage(error.response.data?.detail || "Error uploading file. Please try again.")
                }
            } else if (axios.isAxiosError(error) && error.request) {
                // The request was made but no response was received (often CORS or network error)
                setUploadStatus("error")
                setStatusMessage(
                    "Network or CORS error: no response received from the API. Check browser console for CORS errors and ensure the API is reachable from the browser."
                )
            } else {
                setUploadStatus("error")
                setStatusMessage("Unexpected error. Check console for details.")
            }
        }
    }

    return (
        <div className="flex items-center justify-center min-h-svh p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Choose EPUB File to Upload</h1>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Open Library Edition ID</Label>
                        <Input 
                            id="title" 
                            placeholder="Ex. OL60638966M" 
                            value={editionId}
                            onChange={(e) => setEditionId(e.target.value)}
                        />
                        <p className="text-muted-foreground text-sm">
                            <a href="https://openlibrary.org/books/add" target="_blank" rel="noopener noreferrer" className="text-primary underline">Add</a> the Open book edition ID to link the uploaded EPUB to its metadata from Open Library.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="file">EPUB File</Label>
                        <div className="flex items-center gap-3">
                            <UploadIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                            <Input
                                className="
                                    file:mr-4 
                                    file:px-4
                                    file:rounded-md
                                    file:text-sm
                                    file:font-semibold
                                    file:bg-primary
                                    file:text-primary-foreground
                                    file:cursor-pointer
                                    hover:file:bg-primary/90
                                    cursor-pointer
                                    border-dotted
                                "
                                id="file"
                                type="file"
                                accept=".epub"
                                onChange={handleFileChange}
                            />
                        </div>
                        {file && (
                            <p className="text-sm text-muted-foreground">Selected: {file.name}</p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <Label>Encryption needed?</Label>
                        <RadioGroup 
                            value={encryption} 
                            onValueChange={setEncryption}
                            className="space-y-2"
                        >
                            <div className="flex items-center gap-3">
                                <RadioGroupItem value="yes" id="r2" />
                                <Label htmlFor="r2" className="font-normal cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <RadioGroupItem value="no" id="r3" />
                                <Label htmlFor="r3" className="font-normal cursor-pointer">No</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="pt-4 space-y-4">
                        <Button 
                            onClick={handleUpload} 
                            disabled={uploadStatus === "uploading" || !file}
                            className="w-full"
                        >
                            {uploadStatus === "uploading" ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                "Upload File"
                            )}
                        </Button>

                        {/* Status Messages */}
                        {uploadStatus !== "idle" && statusMessage && (
                            <div className={`
                                flex items-start gap-3 p-4 rounded-md border
                                ${uploadStatus === "success" ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : ""}
                                ${uploadStatus === "error" ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" : ""}
                                ${uploadStatus === "conflict" ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800" : ""}
                                ${uploadStatus === "uploading" ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" : ""}
                            `}>
                                {uploadStatus === "success" && (
                                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                )}
                                {uploadStatus === "error" && (
                                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                )}
                                {uploadStatus === "conflict" && (
                                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                                )}
                                {uploadStatus === "uploading" && (
                                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-spin" />
                                )}
                                <div className="flex-1">
                                    <p className={`text-sm font-medium
                                        ${uploadStatus === "success" ? "text-green-900 dark:text-green-100" : ""}
                                        ${uploadStatus === "error" ? "text-red-900 dark:text-red-100" : ""}
                                        ${uploadStatus === "conflict" ? "text-yellow-900 dark:text-yellow-100" : ""}
                                        ${uploadStatus === "uploading" ? "text-blue-900 dark:text-blue-100" : ""}
                                    `}>
                                        {statusMessage}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}