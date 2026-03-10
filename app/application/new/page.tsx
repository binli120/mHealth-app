"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { IntakeChat } from "@/components/application/aca3/intake-chat"
import { FormWizard } from "@/components/application/aca3/form-wizard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ApplicationEntryMode = "chat" | "wizard"

function NewApplicationPageContent() {
  const searchParams = useSearchParams()
  const queryApplicationId = searchParams.get("applicationId")?.trim()
  const requestedMode = searchParams.get("mode")
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
              Start with chat intake or switch to the standard form wizard.
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="chat">Chat Intake</TabsTrigger>
            <TabsTrigger value="wizard">Form Wizard</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="mt-4">
          <IntakeChat
            applicationId={queryApplicationId || undefined}
            onSwitchToWizard={() => setEntryMode("wizard")}
          />
        </TabsContent>

        <TabsContent value="wizard" className="mt-4">
          <FormWizard applicationId={queryApplicationId || undefined} />
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
