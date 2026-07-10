/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */
import { CheckCircle2 } from "lucide-react"

export default function MobileDonePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h1 className="text-xl font-semibold">All done!</h1>
      <p className="max-w-xs text-sm text-muted-foreground">Your progress has been saved. You can return to your desktop to continue.</p>
    </div>
  )
}
