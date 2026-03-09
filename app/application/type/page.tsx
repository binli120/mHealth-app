"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createApplication } from "@/lib/redux/features/application-slice"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { useAppDispatch } from "@/lib/redux/hooks"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { ArrowLeft, FileText, ChevronRight } from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"

function createApplicationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Secure random UUID generation is unavailable in this browser.")
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (item) => item.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export default function ApplicationTypePage() {
  const router = useRouter()
  const dispatch = useAppDispatch()

  const handleSelectType = async (applicationType: (typeof MASSHEALTH_APPLICATION_TYPES)[number]["id"]) => {
    const applicationId = createApplicationId()
    try {
      await authenticatedFetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId,
          applicationType,
        }),
      })
    } catch {
      // Continue using local app context; draft autosave will upsert later.
    }

    dispatch(
      createApplication({
        applicationId,
        applicationType,
      }),
    )
    router.push(`/application/new?applicationId=${applicationId}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">MassHealth</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col px-4 py-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              Choose Your MassHealth Application
            </h1>
            <p className="mt-2 text-muted-foreground">
              Select the exact form you need to complete
            </p>
          </div>

          {/* Application Types */}
          <div className="space-y-4">
            {MASSHEALTH_APPLICATION_TYPES.map((type) => {
              const Icon = FileText
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    void handleSelectType(type.id)
                  }}
                  className="w-full text-left"
                >
                  <Card className="border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
                    <CardContent className="flex items-center gap-4 p-6">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-card-foreground">{type.shortLabel}</h3>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {type.formCode}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{type.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </button>
              )
            })}
          </div>

          {/* Help Section */}
          <Card className="mt-8 border-border bg-secondary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-card-foreground">Not sure which to choose?</CardTitle>
              <CardDescription>
                Our support team can help you determine the right application type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full sm:w-auto">
                Contact Support: 1-800-841-2900
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
