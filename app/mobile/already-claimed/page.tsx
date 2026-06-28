/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */
import { AlertTriangle } from "lucide-react"

export default function MobileAlreadyClaimedPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <h1 className="text-xl font-semibold">Already in Use</h1>
      <p className="max-w-xs text-sm text-muted-foreground">This link was already opened on another device. Return to your desktop and generate a new QR code.</p>
    </div>
  )
}
