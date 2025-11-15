"use client"
import { useState } from "react"
import axios from "axios"
import { UploadIcon } from "lucide-react"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"

export default function UploadForm() {
    const [editionId, setEditionId] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [encryption, setEncryption] = useState("no")
    const [isUploading, setIsUploading] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) {
            alert("Please select a file")
            return
        }

        if (!editionId) {
            alert("Please enter an Open Library Edition ID")
            return
        }

        const numericId = editionId.replace(/\D/g, "")
        if (!numericId || isNaN(Number(numericId))) {
            alert("Please enter a valid Open Library Edition ID (e.g., OL60638966M)")
            return
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("openlibrary_edition", numericId)
        formData.append("encrypted", encryption === "yes" ? "true" : "false")

        setIsUploading(true)
        try {
            // Use environment variable or fallback to localhost for development
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
            const response = await axios.post(`${apiUrl}/v1/api/upload`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            })
            console.log("File uploaded successfully:", response.data)
            alert("File uploaded successfully!")
            // Reset form
            setEditionId("")
            setFile(null)
            setEncryption("no")
            // Clear file input
            const fileInput = document.getElementById("file") as HTMLInputElement
            if (fileInput) fileInput.value = ""
        } catch (error) {
            console.error("Error uploading file:", error)
            if (axios.isAxiosError(error) && error.response) {
                alert(`Error: ${error.response.data.detail || error.response.statusText}`)
            } else {
                alert("Error uploading file. Please try again.")
            }
        } finally {
            setIsUploading(false)
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

                    <div className="pt-4">
                        <Button 
                            onClick={handleUpload} 
                            disabled={isUploading || !file}
                            className="w-full"
                        >
                            {isUploading ? "Uploading..." : "Upload File"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}