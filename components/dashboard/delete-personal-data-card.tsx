"use client"

import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PERSONAL_DATA_CONFIRMATION_PHRASE } from "@/lib/account/personal-data-contract"
import { resetApplications } from "@/lib/redux/features/application-slice"
import { resetProfile } from "@/lib/redux/features/user-profile-slice"
import { useAppDispatch } from "@/lib/redux/hooks"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

function clearApplicationBrowserData() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (
        key?.startsWith("healthcompass.application") ||
        key?.startsWith("mhealth:") ||
        key?.startsWith("mh-")
      ) {
        storage.removeItem(key)
      }
    }
  }
}

interface DeletePersonalDataCardProps {
  onDeleted?: () => void
}

export function DeletePersonalDataCard({ onDeleted }: DeletePersonalDataCardProps) {
  const dispatch = useAppDispatch()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")
  const isConfirmed = confirmation === PERSONAL_DATA_CONFIRMATION_PHRASE

  function handleOpenChange(open: boolean) {
    if (isDeleting) return
    setIsOpen(open)
    if (!open) {
      setConfirmation("")
      setError("")
    }
  }

  async function handleDelete() {
    if (!isConfirmed || isDeleting) return
    setIsDeleting(true)
    setError("")

    try {
      const response = await authenticatedFetch("/api/account/personal-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error)

      clearApplicationBrowserData()
      dispatch(resetProfile())
      dispatch(resetApplications())
      setIsOpen(false)
      if (onDeleted) onDeleted()
      else window.location.assign("/customer/dashboard")
    } catch {
      setError("We could not delete all of your data. Nothing is marked complete; please try again.")
      setIsDeleting(false)
    }
  }

  return (
    <Card className="border-destructive/40 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Trash2 className="h-4 w-4" /> Delete all personal data
        </CardTitle>
        <CardDescription>
          Permanently remove your profile, applications, statuses, messages, and uploaded files while keeping your login account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete all personal data</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>This cannot be undone</AlertDialogTitle>
              <AlertDialogDescription>
                Your login will remain, but every profile field, application, status, message, and saved file will be permanently deleted. Type <strong>{PERSONAL_DATA_CONFIRMATION_PHRASE}</strong> to continue.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              aria-label={`Type ${PERSONAL_DATA_CONFIRMATION_PHRASE} to confirm`}
              autoComplete="off"
              disabled={isDeleting}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value)
                setError("")
              }}
              placeholder={PERSONAL_DATA_CONFIRMATION_PHRASE}
            />
            {error ? <p className="text-sm text-destructive" aria-live="polite">{error}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!isConfirmed || isDeleting}
                onClick={(event) => {
                  event.preventDefault()
                  void handleDelete()
                }}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Permanently delete data"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
