"use client"

/**
 * "Add Passkey" button for the admin sidebar footer.
 * Manages its own registration flow state so AdminSidebar stays presentational.
 */

import { useState } from "react"
import { startRegistration } from "@simplewebauthn/browser"
import { KeyRound } from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

export function AdminPasskeyButton() {
  const [registering, setRegistering] = useState(false)

  const handleRegister = async () => {
    setRegistering(true)
    try {
      const optionsRes = await authenticatedFetch("/api/auth/passkey/register/options", {
        method: "POST",
      })
      const optionsPayload = (await optionsRes.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        options?: Parameters<typeof startRegistration>[0]["optionsJSON"]
      }
      if (!optionsRes.ok || !optionsPayload.ok || !optionsPayload.options) {
        window.alert(optionsPayload.error ?? "Unable to start passkey registration.")
        return
      }

      const credential = await startRegistration({ optionsJSON: optionsPayload.options })
      const verifyRes = await authenticatedFetch("/api/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify({ response: credential, name: "Admin passkey" }),
      })
      const verifyPayload = (await verifyRes.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!verifyRes.ok || !verifyPayload.ok) {
        window.alert(verifyPayload.error ?? "Unable to save passkey.")
        return
      }
      window.alert("Admin passkey registered.")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to register passkey.")
    } finally {
      setRegistering(false)
    }
  }

  return (
    <button
      onClick={() => void handleRegister()}
      disabled={registering}
      className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      <KeyRound className="size-4" />
      {registering ? "Adding Passkey..." : "Add Passkey"}
    </button>
  )
}
