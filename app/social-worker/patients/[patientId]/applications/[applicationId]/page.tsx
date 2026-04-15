/**
 * SW-scoped "edit existing draft" page — stays inside the /social-worker/ layout
 * so SWSessionProvider (and the active screen-share) is never unmounted.
 *
 * @author Bin Lee
 */

"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { ApplicationAssistant } from "@/components/application/aca3/application-assistant"
import { FormWizard } from "@/components/application/aca3/form-wizard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApplicationEntryMode } from "@/lib/applications/types"
import { Sparkles } from "lucide-react"

export default function SWEditApplicationPage() {
  const params = useParams()
  const patientId     = params.patientId     as string
  const applicationId = params.applicationId as string
  const [entryMode, setEntryMode] = useState<ApplicationEntryMode>("wizard")

  return (
    <div className="container mx-auto space-y-4 px-4 py-6">
      <Tabs
        value={entryMode}
        onValueChange={(value) => setEntryMode(value as ApplicationEntryMode)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Continue Application</h1>
            <p className="text-sm text-muted-foreground">
              Filling this application on behalf of your patient.
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="chat" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="wizard">Form Wizard</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="mt-4">
          <ApplicationAssistant
            applicationId={applicationId}
            onSwitchToWizard={() => setEntryMode("wizard")}
          />
        </TabsContent>

        <TabsContent value="wizard" className="mt-4">
          <FormWizard
            applicationId={applicationId}
            actingForPatientId={patientId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
