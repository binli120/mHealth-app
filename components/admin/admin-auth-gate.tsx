"use client"

/**
 * Renders the appropriate full-screen state while admin auth is being
 * resolved.  Once `authState` is "ready", renders `children` directly.
 *
 * Responsibility: loading screen, "not-admin" error screen, dev role grant.
 * Everything else (sidebar, layout shell) lives in AdminLayout.
 */

import { AlertCircle, Loader2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

export type AdminAuthState = "loading" | "unauthenticated" | "not-admin" | "ready"

interface Props {
  authState: AdminAuthState
  adminEmail: string | null
  granting: boolean
  onGrantAdmin: () => void
  onLogout: () => void
  children: React.ReactNode
}

export function AdminAuthGate({
  authState,
  adminEmail,
  granting,
  onGrantAdmin,
  onLogout,
  children,
}: Props) {
  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading...
      </div>
    )
  }

  if (authState === "not-admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 size-10 text-warning" />
          <h2 className="mb-2 text-lg font-semibold text-foreground">Admin Role Required</h2>
          <p className="mb-1 text-sm text-muted-foreground">
            Logged in as: <span className="font-medium text-foreground">{adminEmail}</span>
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            This account does not have the admin role.
          </p>
          <Button onClick={onGrantAdmin} disabled={granting} className="mb-3 w-full">
            {granting ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
            Grant Admin Role (Dev Only)
          </Button>
          <Button onClick={onLogout} variant="ghost" size="sm">
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
