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
import { UserRound } from "lucide-react"

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
  const requestedMode = searchParams.get("mode")
  const prefillKey = searchParams.get("prefillKey")
  // When a social worker opens the form on behalf of a patient
  const actingForPatientId = searchParams.get("patientId")?.trim() || undefined

  // Consumed once from sessionStorage on mount — shared across both tabs
  const [prefillFormData] = useState<Partial<ApplicationFormData> | undefined>(
    () => readPrefillFromSessionStorage(prefillKey),
  )

  const urlEntryMode = useMemo(
    () => resolveEntryMode({ requestedMode, prefillKey, applicationId: queryApplicationId }),
    [requestedMode, prefillKey, queryApplicationId],
  )
  const [entryMode, setEntryMode] = useState<ApplicationEntryMode>(urlEntryMode)

  useEffect(() => {
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
        onValueChange={(value) => setEntryMode(value as ApplicationEntryMode)}
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

        <TabsContent value="chat" className="mt-4">
          {prefillFormData ? (
            <ApplicationAssistant
              applicationId={queryApplicationId || undefined}
              actingForPatientId={actingForPatientId}
              prefillFormData={prefillFormData}
              onSwitchToWizard={() => setEntryMode("wizard")}
            />
          ) : (
            <IntakeChat
              applicationId={queryApplicationId || undefined}
              actingForPatientId={actingForPatientId}
              onSwitchToWizard={() => setEntryMode("wizard")}
              onSaveAndExit={() => router.push("/customer/dashboard")}
            />
          )}
        </TabsContent>

        <TabsContent value="wizard" className="mt-4">
          <FormWizard
            applicationId={queryApplicationId || undefined}
            actingForPatientId={actingForPatientId}
            prefillFormData={prefillFormData}
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
