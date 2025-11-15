"use client"
import { UploadIcon } from "lucide-react"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"

export default function UploadForm() {
    return (
        <div className="flex items-center justify-center min-h-svh p-4">
            <div className="w-full max-w-md space-y-15">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Choose EPUB File to Upload</h1>
                </div>

                <div className="space-y-10">
                    <div className="space-y-2">
                        <Label htmlFor="title">Open Library Edition ID</Label>
                        <Input id="title" placeholder="Ex. OL60638966M" />
                        <a href="https://openlibrary.org/works/OL60638966M" target="_blank" rel="noopener noreferrer" className="text-primary underline">Add</a> the Open book edition ID to link the uploaded EPUB to its metadata from Open Library.
                        <p className="text-muted-foreground text-sm">
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
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label >Encryption needed?</Label>
                        <RadioGroup defaultValue="comfortable" className="space-y-2">
                            <div className="flex items-center gap-3">
                                <RadioGroupItem value="comfortable" id="r2" />
                                <Label htmlFor="r2" className="font-normal cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <RadioGroupItem value="compact" id="r3" />
                                <Label htmlFor="r3" className="font-normal cursor-pointer">No</Label>
                            </div>
                        </RadioGroup>
                        <div className="pt-4">
                            <Button>Upload File</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}