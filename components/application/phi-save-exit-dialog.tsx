/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useState } from "react"
import { CheckCircle2, Copy, Download, FileKey2, Loader2, Lock, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  splitWizardState,
  buildStorageDraft,
  parseResumeTokenString,
  downloadTokenFile,
  deserializeToken,
} from "@/lib/phi-token/token"
import { restorePhiDraftState } from "@/lib/phi-token/restore"
import type { WizardState } from "@/components/application/aca3/types"

// ─── Save & Exit dialog ───────────────────────────────────────────────────────

type SavePhase = "confirm" | "saving" | "done" | "error"

interface PhiSaveExitDialogProps {
  open: boolean
  applicationId: string
  wizardState: WizardState
  actingForPatientId?: string
  onBeforeSecureSave?: () => Promise<boolean>
  onExit: () => void
  onCancel: () => void
}

export function PhiSaveExitDialog({
  open,
  applicationId,
  wizardState,
  actingForPatientId,
  onBeforeSecureSave,
  onExit,
  onCancel,
}: PhiSaveExitDialogProps) {
  const [phase, setPhase] = useState<SavePhase>("confirm")
  const [errorMessage, setErrorMessage] = useState("")
  const [backupToken, setBackupToken] = useState("")
  const [copied, setCopied] = useState(false)

  const handleSave = useCallback(async () => {
    setPhase("saving")
    setErrorMessage("")

    try {
      if (onBeforeSecureSave) {
        const saved = await onBeforeSecureSave()
        if (!saved) {
          throw new Error("Unable to save application progress. Please try again.")
        }
      }

      const full = { ...wizardState, errors: {}, persistedAt: new Date().toISOString() }
      const { phiPayload } = splitWizardState(full as Record<string, unknown>)
      const { resumeId, encryptedBlob, keyBase64, resumeTokenString } = await buildStorageDraft(
        applicationId,
        phiPayload,
      )

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (actingForPatientId) headers["X-Acting-For-Patient"] = actingForPatientId

      const response = await authenticatedFetch(
        `/api/applications/${encodeURIComponent(applicationId)}/phi-draft`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ resumeId, encryptedBlob, aesKeyBase64: keyBase64 }),
        },
      )

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      setBackupToken(resumeTokenString)
      setPhase("done")
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save. Please try again.",
      )
      setPhase("error")
    }
  }, [applicationId, actingForPatientId, onBeforeSecureSave, wizardState])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(backupToken)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }, [backupToken])

  const handleDownload = useCallback(() => {
    try {
      const token = deserializeToken(backupToken)
      downloadTokenFile(token, applicationId)
    } catch {
      // fallback: download as plain text
      const blob = new Blob([backupToken], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `healthcompass-draft-${applicationId.slice(0, 8)}.token`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [backupToken, applicationId])

  const handleRetry = useCallback(() => {
    setPhase("confirm")
    setErrorMessage("")
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && phase !== "saving") {
          if (phase === "done") onExit()
          else onCancel()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileKey2 className="h-5 w-5 text-blue-600 shrink-0" />
            Save your application securely
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Personal information — name, date of birth, SSN, address — is encrypted in your browser
            before saving. Your data is stored securely and will be available when you sign in again.
          </DialogDescription>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="flex flex-col gap-3 mt-1">
            <Alert className="bg-blue-50 border-blue-200">
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-800 text-sm ml-2">
                Your encrypted data is tied to your account. No extra code needed to resume.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()}>
                Save &amp; Exit
              </Button>
            </div>
          </div>
        )}

        {phase === "saving" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Encrypting and saving…
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col gap-4 mt-1">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <AlertDescription className="text-green-800 text-sm ml-2">
                Saved! Your progress will be restored automatically when you sign in and open this
                application.
              </AlertDescription>
            </Alert>

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none hover:text-foreground">
                Download backup token (optional)
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <p className="leading-relaxed">
                  As a backup, you can save a token file. It contains the encryption key needed to
                  restore your data without an account.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopy()}
                    className="flex-1 gap-1"
                  >
                    {copied ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copy token</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="flex-1 gap-1"
                  >
                    <Download className="h-3.5 w-3.5" /> Download file
                  </Button>
                </div>
              </div>
            </details>

            <Button onClick={onExit}>
              Done — exit
            </Button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-3 mt-1">
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
            </Alert>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleRetry}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Resume prompt (shown when a draft has an encrypted blob) ─────────────────

type ResumePhase = "prompt" | "loading" | "error"

interface PhiResumePromptProps {
  applicationId: string
  resumeId: string
  /** True when the server also holds the encrypted AES key — user can auto-restore. */
  hasServerKey: boolean
  actingForPatientId?: string
  serverState: Record<string, unknown>
  onRestored: (mergedState: Record<string, unknown>) => void
  onSkip: () => void
}

export function PhiResumePrompt({
  applicationId,
  resumeId,
  hasServerKey,
  actingForPatientId,
  serverState,
  onRestored,
  onSkip,
}: PhiResumePromptProps) {
  const [tokenInput, setTokenInput] = useState("")
  const [phase, setPhase] = useState<ResumePhase>("prompt")
  const [errorMessage, setErrorMessage] = useState("")

  const doRestore = useCallback(
    async (keyBase64: string) => {
      setPhase("loading")
      setErrorMessage("")

      try {
        const mergedState = await restorePhiDraftState({
          applicationId,
          resumeId,
          serverState,
          keyBase64,
          actingForPatientId,
        })
        onRestored(mergedState)
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Could not restore. Check your resume code.",
        )
        setPhase("error")
      }
    },
    [resumeId, applicationId, actingForPatientId, serverState, onRestored],
  )

  const handleAutoRestore = useCallback(() => {
    // Key will be returned by the server in the GET response.
    void doRestore("")
  }, [doRestore])

  const handleManualRestore = useCallback(async () => {
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    try {
      const { keyBase64 } = parseResumeTokenString(trimmed)
      await doRestore(keyBase64)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid resume token.")
      setPhase("error")
    }
  }, [tokenInput, doRestore])

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Lock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            Personal information was saved securely
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            {hasServerKey
              ? "Restore your name, address, SSN, and other details with one click."
              : "Enter your backup token to restore your name, address, SSN, and other details."}
          </p>
        </div>
      </div>

      {hasServerKey ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleAutoRestore}
            disabled={phase === "loading"}
            className="gap-1.5"
          >
            {phase === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Restore my information
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value)
              if (phase === "error") setPhase("prompt")
            }}
            placeholder="Paste your backup token here…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Backup token"
          />
          <Button
            size="sm"
            onClick={() => void handleManualRestore()}
            disabled={!tokenInput.trim() || phase === "loading"}
          >
            {phase === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Restore"
            )}
          </Button>
        </div>
      )}

      {phase === "error" && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="text-xs text-muted-foreground underline underline-offset-2 self-start"
      >
        Skip — I&apos;ll re-enter my information manually
      </button>
    </div>
  )
}
