/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * SW-scoped "edit existing draft" page — stays inside the /social-worker/ layout
 * so SWSessionProvider (and the active screen-share) is never unmounted.
 *
 * @author: Bin Lee
 */

"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { FormWizard } from "@/components/application/aca3/form-wizard"
import { IntakeChat } from "@/components/application/aca3/intake-chat"
import { Saca2UnavailableNotice } from "@/components/application/saca2/saca2-unavailable-notice"
import { useIsSaca2Application } from "@/components/application/saca2/use-is-saca2-application"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ApplicationEntryMode } from "@/lib/applications/types"
import { UserRound } from "lucide-react"

export default function SWEditApplicationPage() {
  const params = useParams()
  const patientId     = params.patientId     as string
  const applicationId = params.applicationId as string
  const [entryMode, setEntryMode] = useState<ApplicationEntryMode>("chat")
  const [hasOpenedChat, setHasOpenedChat] = useState(true)
  // Must run before any early return. "" = Redux type unknown, so the server draft is checked.
  // Bumped by "Try again" to re-run a failed lookup without reloading the page (and the SW session with it).
  const [lookupRetryKey, setLookupRetryKey] = useState(0)
  const saca2Lookup = useIsSaca2Application(applicationId, "", patientId, lookupRetryKey)

  if (saca2Lookup === "error") {
    return (
      <div className="container mx-auto px-4 py-6">
        <section
          data-testid="application-lookup-error"
          role="alert"
          className="space-y-3 rounded-lg border bg-card p-6 text-card-foreground"
        >
          <h2 className="text-lg font-semibold">We couldn&apos;t load this application</h2>
          <p className="text-sm text-muted-foreground">
            Check the connection and try again. The saved answers have not been changed.
          </p>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm font-medium"
            onClick={() => setLookupRetryKey((key) => key + 1)}
          >
            Try again
          </button>
        </section>
      </div>
    )
  }
  if (saca2Lookup === "saca2") {
    return (
      <div className="container mx-auto px-4 py-6">
        <Saca2UnavailableNotice variant="social-worker" />
      </div>
    )
  }
  if (saca2Lookup === "unknown") {
    return (
      <div className="container mx-auto px-4 py-6">
        <p data-testid="sw-application-loading" className="text-sm text-muted-foreground">
          Loading application…
        </p>
      </div>
    )
  }

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
            <h1 className="text-xl font-semibold text-foreground">Continue Application</h1>
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
            applicationId={applicationId}
            actingForPatientId={patientId}
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
