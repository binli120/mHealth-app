/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ApplicationAssistant } from "@/components/application/aca3/application-assistant"
import { FormWizard } from "@/components/application/aca3/form-wizard"
import { IntakeChat } from "@/components/application/aca3/intake-chat"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApplicationEntryMode } from "@/lib/applications/types"
import type { ApplicationFormData } from "@/lib/redux/features/application-slice"
import { useAppSelector } from "@/lib/redux/hooks"
import { getApplicationTypeLabel } from "@/lib/masshealth/application-types"
import { createUuid } from "@/lib/utils/random-id"
import { UserRound } from "lucide-react"
import type { UserProfile } from "@/lib/user-profile/types"

function buildPrefillFromProfile(profile: UserProfile | null): Partial<ApplicationFormData> | undefined {
  if (!profile) return undefined
  const fields: Partial<ApplicationFormData> = {}
  if (profile.firstName) fields.firstName = profile.firstName
  if (profile.lastName) fields.lastName = profile.lastName
  if (profile.dateOfBirth) fields.dob = profile.dateOfBirth
  if (profile.phone) fields.phone = profile.phone
  if (profile.addressLine1) fields.address = profile.addressLine1
  if (profile.addressLine2) fields.apartment = profile.addressLine2
  if (profile.city) fields.city = profile.city
  if (profile.state) fields.state = profile.state
  if (profile.zip) fields.zip = profile.zip
  if (profile.citizenshipStatus) fields.citizenship = profile.citizenshipStatus
  return Object.keys(fields).length > 0 ? fields : undefined
}

function readPrefillFromSessionStorage(key: string | null): Partial<ApplicationFormData> | undefined {
  if (!key || typeof window === "undefined") return undefined
  try {
    const raw = sessionStorage.getItem(key) ?? ""
    sessionStorage.removeItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Partial<ApplicationFormData>
    }
  } catch { /* ignore parse errors */ }
  return undefined
}

function resolveEntryMode({
  requestedMode,
  prefillKey,
  applicationId,
}: {
  requestedMode: string | null
  prefillKey: string | null
  applicationId: string | undefined
}): ApplicationEntryMode {
  if (requestedMode === "wizard" || requestedMode === "chat") {
    return requestedMode
  }

  if (prefillKey) {
    return "chat"
  }

  return "chat"
}

function NewApplicationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryApplicationId = searchParams.get("applicationId")?.trim()
  const [newApplicationId] = useState(() => createUuid())
  const effectiveApplicationId = queryApplicationId || newApplicationId
  const requestedMode = searchParams.get("mode")
  const prefillKey = searchParams.get("prefillKey")
  // When a social worker opens the form on behalf of a patient
  const actingForPatientId = searchParams.get("patientId")?.trim() || undefined

  // Consumed once from sessionStorage on mount — shared across both tabs
  const [prefillFormData] = useState<Partial<ApplicationFormData> | undefined>(
    () => readPrefillFromSessionStorage(prefillKey),
  )

  const userProfile = useAppSelector((state) => state.userProfile?.profile ?? null)
  // Profile-based prefill for the FormWizard. Document upload prefill takes precedence.
  const wizardPrefill = useMemo(
    () => prefillFormData ?? buildPrefillFromProfile(userProfile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],  // evaluated once on mount — profile is stable after login
  )

  const urlEntryMode = useMemo(
    () => resolveEntryMode({ requestedMode, prefillKey, applicationId: queryApplicationId }),
    [requestedMode, prefillKey, queryApplicationId],
  )
  const [entryMode, setEntryMode] = useState<ApplicationEntryMode>(urlEntryMode)
  const [hasOpenedChat, setHasOpenedChat] = useState(urlEntryMode === "chat")

  useEffect(() => {
    if (urlEntryMode === "chat") setHasOpenedChat(true)
    setEntryMode(urlEntryMode)
  }, [urlEntryMode])

  const savedApplicationType = useAppSelector((state) => {
    if (!queryApplicationId) return ""
    return state.application.applicationsById[queryApplicationId]?.newApplicationForm.applicationType ?? ""
  })
  const typeLabel = getApplicationTypeLabel(savedApplicationType || null)
  const isResuming = Boolean(queryApplicationId)
  const pageTitle = isResuming
    ? `Continue ${savedApplicationType ? typeLabel + " " : ""}Application`
    : "New Application"

  return (
    <div className="container mx-auto space-y-4 px-4 py-6">
      <Tabs
        value={entryMode}
        onValueChange={(value) => {
          const nextMode = value as ApplicationEntryMode
          if (nextMode === "chat") setHasOpenedChat(true)
          setEntryMode(nextMode)
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {actingForPatientId
                ? "Filling this application on behalf of your patient."
                : isResuming
                  ? "Pick up where you left off — your answers are saved."
                  : "Use Compass to complete your application through conversation, or switch to the form wizard."}
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="chat" className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" />
              Compass
            </TabsTrigger>
            <TabsTrigger value="wizard">Form Wizard</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="chat"
          className="mt-4"
          style={entryMode === "chat" ? undefined : { display: "none" }}
          {...(hasOpenedChat ? { forceMount: true } : {})}
        >
          {prefillFormData ? (
            <ApplicationAssistant
              applicationId={effectiveApplicationId}
              actingForPatientId={actingForPatientId}
              prefillFormData={prefillFormData}
              onSwitchToWizard={() => setEntryMode("wizard")}
            />
          ) : (
            <IntakeChat
              applicationId={effectiveApplicationId}
              skipServerDraft={!queryApplicationId}
              actingForPatientId={actingForPatientId}
              onSwitchToWizard={() => setEntryMode("wizard")}
              onSaveAndExit={() => router.push("/customer/dashboard")}
            />
          )}
        </TabsContent>

        <TabsContent value="wizard" className="mt-4">
          <FormWizard
            applicationId={effectiveApplicationId}
            actingForPatientId={actingForPatientId}
            prefillFormData={wizardPrefill}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-6" />}>
      <NewApplicationPageContent />
    </Suspense>
  )
}
