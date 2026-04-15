/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Users,
  GraduationCap,
  CreditCard,
  Settings,
  Bell,
  ArrowLeft,
  User,
} from "lucide-react"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { Button } from "@/components/ui/button"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import { ErrorCard } from "@/components/shared/ErrorCard"
import { PersonalSection } from "@/components/user-profile/PersonalSection"
import { FamilySummarySection } from "@/components/user-profile/FamilySummarySection"
import { EducationSection } from "@/components/user-profile/EducationSection"
import { BankSection } from "@/components/user-profile/BankSection"
import { AppSettingsSection } from "@/components/user-profile/AppSettingsSection"
import { NotificationsSection } from "@/components/user-profile/NotificationsSection"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { useAppDispatch } from "@/lib/redux/hooks"
import { setProfile } from "@/lib/redux/features/user-profile-slice"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { ShieldHeartIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { UserProfile } from "@/lib/user-profile/types"
import { NAV_ITEMS } from "./page.constants"
import type { SectionId, UserProfileApiResponse } from "./page.types"

export default function CustomerProfilePage() {
  const dispatch = useAppDispatch()
  const [profile, setLocalProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>("personal")

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch("/api/user-profile", {
        method: "GET",
        cache: "no-store",
      })
      const payload = (await res.json().catch(() => ({}))) as UserProfileApiResponse
      if (!res.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.error ?? "Failed to load profile.")
      }
      setLocalProfile(payload.profile)
      dispatch(setProfile(payload.profile))
      dispatch(setLanguage(payload.profile.profileData.preferredLanguage))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.")
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => { void loadProfile() }, [loadProfile])

  const handleSectionSave = (updated: Partial<UserProfile>) => {
    setLocalProfile((prev) => {
      const next = prev ? { ...prev, ...updated } : prev
      // Keep Redux in sync so the dashboard navbar avatar updates immediately
      // without requiring a page reload or a separate profile fetch.
      if (next) dispatch(setProfile(next))
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">HealthCompass MA</span>
          </div>
          <Link href="/customer/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Page heading */}
        <div className="mb-8 flex items-center gap-4">
          {profile && (
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              firstName={profile.firstName}
              lastName={profile.lastName}
              size="lg"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Settings"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your personal information, accessibility preferences, and notification settings.
            </p>
          </div>
        </div>

        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <ErrorCard message={error} onRetry={loadProfile} />
        )}

        {!loading && !error && profile && (
          <div className="flex flex-col gap-6 md:flex-row md:gap-8">

            {/* ── Sidebar ── */}
            {/* Mobile: horizontal scrollable strip */}
            <nav
              aria-label="Profile sections"
              className="flex gap-1 overflow-x-auto pb-2 md:hidden"
            >
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activeSection === id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Desktop: vertical sticky sidebar */}
            <nav
              aria-label="Profile sections"
              className="hidden md:block md:w-52 md:shrink-0"
            >
              <ul className="sticky top-24 space-y-0.5">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <li key={id}>
                    <button
                      onClick={() => setActiveSection(id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
                        activeSection === id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ── Content area ── */}
            <main className="min-w-0 flex-1">
              {activeSection === "personal" && (
                <PersonalSection profile={profile} onSaved={handleSectionSave} />
              )}
              {activeSection === "family" && (
                <FamilySummarySection summary={profile.familyProfileSummary} />
              )}
              {activeSection === "education" && (
                <EducationSection profile={profile} onSaved={handleSectionSave} />
              )}
              {activeSection === "bank" && (
                <BankSection profile={profile} onSaved={handleSectionSave} />
              )}
              {activeSection === "settings" && (
                <AppSettingsSection profile={profile} onSaved={handleSectionSave} />
              )}
              {activeSection === "notifications" && (
                <NotificationsSection profile={profile} onSaved={handleSectionSave} />
              )}
            </main>

          </div>
        )}
      </div>
    </div>
  )
}
