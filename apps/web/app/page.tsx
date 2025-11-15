import { UploadIcon } from "lucide-react"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Input } from "@workspace/ui/components/input"
export default function Page() {
  return (
    <div className="flex grid-row items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Upload your EPUB</h1>
        <div className="grid w-full max-w-sm items-center gap-3">
          <Label htmlFor="picture">EPUB</Label>
          <Input id="file" type="file" />
        </div>
        <RadioGroup defaultValue="comfortable">
          <div className="flex items-center gap-3">
            <RadioGroupItem value="comfortable" id="r2" />
            <Label htmlFor="r2">Comfortable</Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="compact" id="r3" />
            <Label htmlFor="r3">Compact</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  )
}
