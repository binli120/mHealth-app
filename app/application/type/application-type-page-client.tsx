/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createApplication } from "@/lib/redux/features/application-slice"
import {
  getApplicationTypeQuickCheckRecommendation,
  isMassHealthApplicationType,
  MASSHEALTH_APPLICATION_TYPES,
  type ApplicationTypeQuickCheckAnswers,
} from "@/lib/masshealth/application-types"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { buildApplicationContinueHref, buildApplicationStartHref } from "@/lib/applications/navigation"
import { cn } from "@/lib/utils"
import { createUuid } from "@/lib/utils/random-id"
import { ArrowLeft, Bot, CheckCircle2, ChevronRight, FileText, Sparkles } from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { getTypeCopy } from "./type-copy"

type ApplicationTypeId = (typeof MASSHEALTH_APPLICATION_TYPES)[number]["id"]

interface ExistingDraftPrompt {
  existingApplicationId: string
  applicationType: ApplicationTypeId
}

interface ApplicationTypePageProps {
  recommendedParam?: string | null
}

export default function ApplicationTypePage({ recommendedParam }: ApplicationTypePageProps) {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.app.language)
  const copy = useMemo(() => getTypeCopy(language), [language])

  const [existingDraftPrompt, setExistingDraftPrompt] = useState<ExistingDraftPrompt | null>(null)
  const [isQuickCheckOpen, setIsQuickCheckOpen] = useState(false)
  const [quickCheckAnswers, setQuickCheckAnswers] = useState<ApplicationTypeQuickCheckAnswers>({})

  const quickCheckQuestions = useMemo(
    () => [
      {
        id: "addingPersonToExistingCase" as const,
        prompt: copy.questions.addingPersonToExistingCase.prompt,
        options: [
          { label: copy.questions.addingPersonToExistingCase.yes, value: "yes" as const },
          { label: copy.questions.addingPersonToExistingCase.no, value: "no" as const },
        ],
      },
      {
        id: "ageGroup" as const,
        prompt: copy.questions.ageGroup.prompt,
        options: [
          { label: copy.questions.ageGroup.senior, value: "senior" as const },
          { label: copy.questions.ageGroup.under65, value: "under65" as const },
        ],
      },
      {
        id: "needsLongTermCare" as const,
        prompt: copy.questions.needsLongTermCare.prompt,
        options: [
          { label: copy.questions.needsLongTermCare.yes, value: "yes" as const },
          { label: copy.questions.needsLongTermCare.no, value: "no" as const },
        ],
      },
      {
        id: "hasMedicare" as const,
        prompt: copy.questions.hasMedicare.prompt,
        options: [
          { label: copy.questions.hasMedicare.yes, value: "yes" as const },
          { label: copy.questions.hasMedicare.no, value: "no" as const },
        ],
      },
    ],
    [copy],
  )

  const quickCheckRecommendation = useMemo(
    () => getApplicationTypeQuickCheckRecommendation(quickCheckAnswers),
    [quickCheckAnswers],
  )

  const nextQuickCheckQuestion = quickCheckRecommendation
    ? undefined
    : quickCheckQuestions.find((question) => !quickCheckAnswers[question.id])
  const recommendedApplicationType = quickCheckRecommendation?.applicationType ??
    (recommendedParam && isMassHealthApplicationType(recommendedParam) ? recommendedParam : undefined)

  const getRecommendationReason = () => {
    if (!quickCheckRecommendation) return ""
    const { applicationType } = quickCheckRecommendation
    if (applicationType === "aca3ap") return copy.reasons.aca3ap
    if (applicationType === "saca2")
      return quickCheckAnswers.needsLongTermCare === "yes"
        ? copy.reasons.saca2_longterm
        : copy.reasons.saca2_senior
    if (applicationType === "msp") return copy.reasons.msp
    return copy.reasons.aca3
  }

  const startNewApplication = async (applicationType: ApplicationTypeId) => {
    const applicationId = createUuid()
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
    router.push(buildApplicationStartHref(applicationId))
  }

  const handleSelectType = async (applicationType: ApplicationTypeId) => {
    try {
      const res = await authenticatedFetch(`/api/applications?status=draft`, { method: "GET" })
      const data = (await res.json()) as {
        ok: boolean
        records?: Array<{ id: string; applicationType: string | null }>
      }
      if (data.ok && data.records) {
        const existingDraft = data.records.find((r) => r.applicationType === applicationType)
        if (existingDraft) {
          setExistingDraftPrompt({ existingApplicationId: existingDraft.id, applicationType })
          return
        }
      }
    } catch {
      // If the check fails, fall through to start a new application.
    }

    await startNewApplication(applicationType)
  }

  const handleContinueExisting = () => {
    if (!existingDraftPrompt) return
    router.push(buildApplicationContinueHref(existingDraftPrompt.existingApplicationId))
    setExistingDraftPrompt(null)
  }

  const handleStartNew = async () => {
    if (!existingDraftPrompt) return
    const { applicationType } = existingDraftPrompt
    setExistingDraftPrompt(null)
    await startNewApplication(applicationType)
  }

  const handleQuickCheckAnswer = (
    id: keyof ApplicationTypeQuickCheckAnswers,
    value: NonNullable<ApplicationTypeQuickCheckAnswers[keyof ApplicationTypeQuickCheckAnswers]>,
  ) => {
    setQuickCheckAnswers((current) => ({ ...current, [id]: value }))
  }

  const handleResetQuickCheck = () => {
    setQuickCheckAnswers({})
  }

  const handleSelectRecommendedType = async () => {
    if (!recommendedApplicationType) return
    setIsQuickCheckOpen(false)
    await handleSelectType(recommendedApplicationType)
  }

  const pendingTypeLabel = existingDraftPrompt
    ? (MASSHEALTH_APPLICATION_TYPES.find((t) => t.id === existingDraftPrompt.applicationType)?.shortLabel ?? existingDraftPrompt.applicationType)
    : ""

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/customer/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{copy.backToHome}</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher className="h-9 w-[132px] border-border bg-card text-foreground" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">HealthCompass MA</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col px-4 py-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              {copy.pageTitle}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {copy.pageSubtitle}
            </p>
          </div>

          {/* Application Types */}
          <div className="space-y-4">
            {MASSHEALTH_APPLICATION_TYPES.map((type) => {
              const Icon = FileText
              const isRecommended = recommendedApplicationType === type.id
              const typeCopy = copy.appTypes[type.id as keyof typeof copy.appTypes]
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    void handleSelectType(type.id)
                  }}
                  className="w-full text-left"
                >
                  <Card
                    className={cn(
                      "border-border bg-card transition-all hover:border-primary/50 hover:shadow-md",
                      isRecommended && "border-emerald-500 bg-emerald-50/50 shadow-sm dark:bg-emerald-950/20",
                    )}
                  >
                    <CardContent className="flex items-center gap-4 p-6">
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10",
                          isRecommended && "bg-emerald-100 dark:bg-emerald-900/40",
                        )}
                      >
                        <Icon className={cn("h-6 w-6 text-primary", isRecommended && "text-emerald-700 dark:text-emerald-300")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-card-foreground">{type.shortLabel}</h3>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {type.formCode}
                          </span>
                          {isRecommended ? (
                            <Badge className="border-emerald-600 bg-emerald-600 text-white">
                              <CheckCircle2 className="h-3 w-3" />
                              {copy.eligible}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {typeCopy?.title ?? type.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {typeCopy?.description ?? type.description}
                        </p>
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
              <CardTitle className="text-base text-card-foreground">{copy.helpTitle}</CardTitle>
              <CardDescription>{copy.helpDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsQuickCheckOpen(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {copy.runQuickCheck}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Quick Eligibility Check Dialog */}
      <Dialog open={isQuickCheckOpen} onOpenChange={setIsQuickCheckOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{copy.quickCheckTitle}</DialogTitle>
            <DialogDescription>{copy.quickCheckDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg bg-background px-3 py-2 text-sm text-foreground shadow-sm">
                  {copy.quickCheckIntro}
                </div>
              </div>

              {quickCheckQuestions.map((question) => {
                const answer = quickCheckAnswers[question.id]
                if (!answer) return null

                const selectedOption = question.options.find((option) => option.value === answer)
                return (
                  <div key={question.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-lg bg-background px-3 py-2 text-sm text-foreground shadow-sm">
                        {question.prompt}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
                        {selectedOption?.label ?? answer}
                      </div>
                    </div>
                  </div>
                )
              })}

              {nextQuickCheckQuestion ? (
                <div className="flex items-start gap-2">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg bg-background px-3 py-2 text-sm text-foreground shadow-sm">
                    {nextQuickCheckQuestion.prompt}
                  </div>
                </div>
              ) : null}
            </div>

            {quickCheckRecommendation ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {MASSHEALTH_APPLICATION_TYPES.find((type) => type.id === quickCheckRecommendation.applicationType)?.shortLabel}{" "}
                  {copy.eligibleLabel}
                </div>
                <p className="mt-1">{getRecommendationReason()}</p>
              </div>
            ) : null}

            {nextQuickCheckQuestion ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {nextQuickCheckQuestion.options.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    onClick={() => handleQuickCheckAnswer(nextQuickCheckQuestion.id, option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleResetQuickCheck}>
              {copy.startOver}
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!recommendedApplicationType}
              onClick={() => { void handleSelectRecommendedType() }}
            >
              {copy.selectEligibleApplication}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Continue vs New Application Dialog */}
      <Dialog open={existingDraftPrompt !== null} onOpenChange={(open) => { if (!open) setExistingDraftPrompt(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.existingDraftTitle(pendingTypeLabel)}</DialogTitle>
            <DialogDescription>{copy.existingDraftDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { void handleStartNew() }}>
              {copy.startNewApplication}
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleContinueExisting}>
              {copy.continueExistingApplication}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
