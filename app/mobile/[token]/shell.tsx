/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Exchanges the one-time token for a Supabase session, then renders
 * the appropriate context component.
 */
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { HandoffContextType } from "@/lib/db/mobile-handoff-session"

// Lazy-loaded context renderers to keep initial bundle small
import dynamic from "next/dynamic"
const IntakeChat = dynamic(() => import("@/components/application/aca3/intake-chat").then(m => ({ default: m.IntakeChat })))
const MobileVoiceRecorder = dynamic(() => import("@/components/handoff/mobile-voice-recorder").then(m => ({ default: m.MobileVoiceRecorder })))
const MassHealthChatWidget = dynamic(() => import("@/components/chat/masshealth-chat-widget").then(m => ({ default: m.MassHealthChatWidget })))

const CONTEXT_LABELS: Record<HandoffContextType, string> = {
  intake_chat: "Intake Chat",
  mh_chat: "Assistant",
  id_verify: "Verify ID",
  voice_message: "Voice Note",
  doc_upload: "Document Upload",
}

type ExchangeState = "loading" | "ready" | "expired" | "claimed"

interface ExchangeResult {
  contextType: HandoffContextType
  contextPayload: Record<string, unknown>
}

export function MobileShell({ token }: { token: string }) {
  const router = useRouter()
  const [exchangeState, setExchangeState] = useState<ExchangeState>("loading")
  const [context, setContext] = useState<ExchangeResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function exchange() {
      if (!token) { setExchangeState("expired"); return }

      try {
        const res = await fetch(`/api/handoff/${encodeURIComponent(token)}/exchange`, { method: "POST" })
        if (cancelled) return
        if (res.status === 409) { setExchangeState("claimed"); return }
        if (!res.ok) { setExchangeState("expired"); return }
        const json = await res.json()
        if (!json.ok) { setExchangeState("expired"); return }

        // Establish Supabase session on mobile
        const supabase = getSupabaseClient()
        const { error: refreshError } = await supabase.auth.refreshSession({ refresh_token: json.refreshToken })
        if (cancelled) return
        if (refreshError) { setExchangeState("expired"); return }

        setContext({ contextType: json.contextType as HandoffContextType, contextPayload: json.contextPayload as Record<string, unknown> })
        setExchangeState("ready")
      } catch {
        if (!cancelled) setExchangeState("expired")
      }
    }

    exchange()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (exchangeState === "expired") router.replace("/mobile/expired")
    if (exchangeState === "claimed") router.replace("/mobile/already-claimed")
  }, [exchangeState, router])

  async function handleSaveAndExit(progressSummary: Record<string, unknown> = {}) {
    try {
      await authenticatedFetch(`/api/handoff/${encodeURIComponent(token)}/complete`, {
        method: "POST",
        body: JSON.stringify({ progressSummary }),
      })
    } catch {
      // best-effort; redirect regardless so user isn't stuck
    }
    router.replace("/mobile/done")
  }

  if (exchangeState === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (exchangeState !== "ready" || !context) return null

  const label = CONTEXT_LABELS[context.contextType]

  // intake_chat panel renders its own header in mobileMode
  const hideShellHeader = context.contextType === "intake_chat"

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Shell header — hidden when the context renderer has its own */}
      {!hideShellHeader && (
        <header className="flex items-center border-b bg-card px-4 py-3">
          <span className="font-semibold text-primary">HealthCompass</span>
          <span className="ml-auto text-sm text-muted-foreground">{label}</span>
        </header>
      )}

      {/* Context renderer */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {context.contextType === "intake_chat" && (
          <IntakeChat
            applicationId={context.contextPayload.applicationId as string}
            onSwitchToWizard={() => {/* no wizard in mobile mode */}}
            onSaveAndExit={() => handleSaveAndExit()}
            mobileMode
          />
        )}
        {context.contextType === "mh_chat" && (
          <MassHealthChatWidget
            mobileMode
            onSaveAndExit={() => handleSaveAndExit()}
            initialHistory={context.contextPayload.chatHistory as Array<{ role: 'user' | 'assistant'; content: string }>}
          />
        )}
        {context.contextType === "voice_message" && (
          <MobileVoiceRecorder
            patientId={context.contextPayload.patientId as string}
            conversationId={context.contextPayload.conversationId as string}
            onSaveAndExit={handleSaveAndExit}
          />
        )}
        {(context.contextType === "id_verify" || context.contextType === "doc_upload") && (
          // These contexts redirect to their existing standalone pages during handoff creation
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            Redirecting…
          </div>
        )}
      </main>
    </div>
  )
}
