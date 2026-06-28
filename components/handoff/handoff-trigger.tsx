/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HandoffTriggerProps {
  onTrigger: () => void
  disabled?: boolean
}

export function HandoffTrigger({ onTrigger, disabled }: HandoffTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onTrigger}
      aria-label="Continue on mobile"
      title="Continue on mobile"
    >
      <Smartphone className="h-4 w-4" />
      <span className="ml-1.5 hidden sm:inline">Mobile</span>
    </Button>
  )
}
