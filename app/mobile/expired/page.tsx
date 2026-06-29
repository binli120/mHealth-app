/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */
import { Clock } from "lucide-react"

export default function MobileExpiredPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <Clock className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold">Link Expired</h1>
      <p className="max-w-xs text-sm text-muted-foreground">This link has expired. Go back to your desktop and click &ldquo;Continue on mobile&rdquo; again to get a new QR code.</p>
    </div>
  )
}
