/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ApplicationAssistant } from "@/components/application/aca3/application-assistant"
import { FormWizard } from "@/components/application/aca3/form-wizard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApplicationEntryMode } from "@/lib/applications/types"
import type { ApplicationFormData } from "@/lib/redux/features/application-slice"
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

function NewApplicationPageContent() {
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

  const [entryMode, setEntryMode] = useState<ApplicationEntryMode>(
    requestedMode === "wizard" ? "wizard" : "chat",
  )

  return (
    <div className="container mx-auto space-y-4 px-4 py-6">
      <Tabs
        value={entryMode}
        onValueChange={(value) => setEntryMode(value as ApplicationEntryMode)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">New Application</h1>
            <p className="text-sm text-muted-foreground">
              {actingForPatientId
                ? "Filling this application on behalf of your patient."
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
          <ApplicationAssistant
            applicationId={queryApplicationId || undefined}
            prefillFormData={prefillFormData}
            onSwitchToWizard={() => setEntryMode("wizard")}
          />
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
