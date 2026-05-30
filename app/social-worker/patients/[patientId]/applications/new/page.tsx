/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * SW-scoped "new application" page — stays inside the /social-worker/ layout
 * so SWSessionProvider (and the active screen-share) is never unmounted.
 *
 * @author: Bin Lee
 */

"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { FormWizard } from "@/components/application/aca3/form-wizard"
import { IntakeChat } from "@/components/application/aca3/intake-chat"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApplicationEntryMode } from "@/lib/applications/types"
import { UserRound } from "lucide-react"

export default function SWNewApplicationPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.patientId as string
  const [entryMode, setEntryMode] = useState<ApplicationEntryMode>("chat")
  const [hasOpenedChat, setHasOpenedChat] = useState(true)

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
            <h1 className="text-xl font-semibold text-foreground">New Application</h1>
            <p className="text-sm text-muted-foreground">
              Filling this application on behalf of your patient.
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
          <IntakeChat
            actingForPatientId={patientId}
            onSwitchToWizard={() => setEntryMode("wizard")}
            onSaveAndExit={() => router.push(`/social-worker/patients/${patientId}/applications`)}
          />
        </TabsContent>

        <TabsContent value="wizard" className="mt-4">
          <FormWizard actingForPatientId={patientId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
