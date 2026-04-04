import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-6 duration-700">
        <LoginForm />
      </div>
    </div>
  )
}
