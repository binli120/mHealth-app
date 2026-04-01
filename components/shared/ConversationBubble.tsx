import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ConversationBubbleProps {
  align: "start" | "end"
  tone?: "primary" | "secondary"
  children: ReactNode
  footer?: ReactNode
  className?: string
  bubbleClassName?: string
}

export function ConversationBubble({
  align,
  tone = "secondary",
  children,
  footer,
  className,
  bubbleClassName,
}: ConversationBubbleProps) {
  const isPrimary = tone === "primary"

  return (
    <div className={cn("flex", align === "end" ? "justify-end" : "justify-start", className)}>
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm shadow-sm",
          isPrimary ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          bubbleClassName,
        )}
      >
        {children}
        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    </div>
  )
}
