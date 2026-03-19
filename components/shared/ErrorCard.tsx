/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ErrorCardProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

/**
 * Centered error state card with an alert icon, message, and optional retry button.
 * Replaces the repeated error card pattern across appeal-assistant, dashboard, etc.
 */
export function ErrorCard({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try Again",
}: ErrorCardProps) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-medium text-destructive">{title}</p>
          <p className="mt-1 text-sm text-gray-600">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
