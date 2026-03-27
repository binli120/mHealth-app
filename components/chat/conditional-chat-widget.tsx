/**
 * ConditionalChatWidget
 * Renders the patient-facing MassHealthChatWidget only on customer-facing pages.
 * Suppressed on /social-worker, /admin, and /reviewer routes because those
 * portals provide their own context-appropriate chat UI (SwChatDialog, etc.)
 *
 * This wrapper exists because app/layout.tsx is a Server Component and cannot
 * call usePathname() directly.
 *
 * @author Bin Lee
 */

"use client"

import { usePathname } from "next/navigation"

import { MassHealthChatWidget } from "@/components/chat/masshealth-chat-widget"

const SUPPRESSED_PREFIXES = ["/social-worker", "/admin", "/reviewer"]

export function ConditionalChatWidget() {
  const pathname = usePathname()

  if (SUPPRESSED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  return <MassHealthChatWidget />
}
