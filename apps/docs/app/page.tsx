import { Button } from "@workspace/ui/components/button"

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground">Welcome to the docs app</p>
        <Button size="sm">Get Started</Button>
      </div>
    </div>
  )
}
