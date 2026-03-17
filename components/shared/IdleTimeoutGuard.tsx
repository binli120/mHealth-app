"use client"

import { Clock } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useIdleTimeout, type UseIdleTimeoutOptions } from "@/hooks/use-idle-timeout"

interface IdleTimeoutGuardProps extends UseIdleTimeoutOptions {
  /** Override the dialog title. Defaults to "Session Expiring Soon". */
  title?: string
}

/**
 * Drop this component anywhere inside an authenticated page or layout.
 * It renders nothing until the idle threshold is crossed, then shows a
 * modal countdown.  Signing out + redirecting to "/" happens automatically
 * when the counter reaches zero, or immediately if the user closes the tab
 * and returns after the window has elapsed.
 *
 * @example
 * // At the top level of your authenticated page:
 * <IdleTimeoutGuard />
 */
export function IdleTimeoutGuard({ title, ...options }: IdleTimeoutGuardProps) {
  const { isWarning, secondsRemaining, resetTimer } = useIdleTimeout(options)

  const minutes = Math.floor(secondsRemaining / 60)
  const secs = secondsRemaining % 60
  const countdown = `${minutes}:${String(secs).padStart(2, "0")}`

  return (
    <AlertDialog open={isWarning}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" aria-hidden="true" />
            {title ?? "Session Expiring Soon"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Your session will expire due to inactivity. You will be signed
                out automatically in:
              </p>
              <p
                className="text-center text-4xl font-bold tabular-nums tracking-widest text-foreground"
                aria-live="polite"
                aria-atomic="true"
              >
                {countdown}
              </p>
              <p className="text-xs text-muted-foreground">
                Click <strong>Stay Signed In</strong> to continue your session.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={resetTimer}
            className="w-full sm:w-auto"
          >
            Stay Signed In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
