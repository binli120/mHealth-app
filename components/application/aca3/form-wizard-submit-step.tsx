/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, ChevronDown, FileCheck2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  markApplicationSubmitted,
} from "@/lib/redux/features/application-slice"
import { openScanner } from "@/lib/redux/features/identity-verification-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  evaluateAca3Eligibility,
  type Aca3EligibilityResult,
} from "@/lib/masshealth/aca3-eligibility-engine"
import { IdentityVerificationBanner } from "@/components/identity/IdentityVerificationBanner"
import { IncomeEvidenceChecklist } from "@/components/application/income-verification/income-evidence-checklist"
import type {
  AnimatedRuleResult,
  ValidateAndSubmitStepProps,
  ValidationPanelFinding,
  WizardState,
} from "./types"
import { clampPersonCount } from "./wizard-reducer"
import { mapWizardToEligibilityInput } from "./wizard-mappings"
import { useFormContext, getIncomeChecklistMemberId } from "./form-wizard-context"
import { useStepValidation } from "./form-wizard-validation"
import { getEngineRuleFixTarget } from "./form-wizard-review-step"
import { StepContainer } from "./form-wizard-steps"

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function ValidateAndSubmitStep({ onBackToReview, onGoToStep }: ValidateAndSubmitStepProps) {
  const { state, dispatch, applicationId, saveDraftNow, apiIncomeVerified } = useFormContext()
  const reduxDispatch = useAppDispatch()
  const validateStep = useStepValidation()
  const identityStatus = useAppSelector((rootState) => rootState.identityVerification.status)
  const identityVerified = identityStatus === "verified"
  const [findings, setFindings] = useState<ValidationPanelFinding[]>([])
  const [eligibilityResult, setEligibilityResult] = useState<Aca3EligibilityResult | null>(null)
  const [animatedRules, setAnimatedRules] = useState<AnimatedRuleResult[]>([])
  const [hasRunValidation, setHasRunValidation] = useState(false)
  const [isRunningValidation, setIsRunningValidation] = useState(false)
  const [rulePanelOpen, setRulePanelOpen] = useState(true)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitAcknowledged, setSubmitAcknowledged] = useState(false)
  const runTokenRef = useRef(0)

  const animateRules = useCallback(async (rules: Array<Omit<AnimatedRuleResult, "runtimeStatus">>) => {
    const runToken = runTokenRef.current + 1
    runTokenRef.current = runToken

    setAnimatedRules(
      rules.map((rule) => ({
        ...rule,
        runtimeStatus: "pending",
      })),
    )

    for (let index = 0; index < rules.length; index += 1) {
      if (runTokenRef.current !== runToken) {
        return
      }

      setAnimatedRules((previous) =>
        previous.map((rule, ruleIndex) =>
          ruleIndex === index
            ? {
                ...rule,
                runtimeStatus: "running",
              }
            : rule,
        ),
      )

      await sleep(260)

      if (runTokenRef.current !== runToken) {
        return
      }

      setAnimatedRules((previous) =>
        previous.map((rule, ruleIndex) =>
          ruleIndex === index
            ? {
                ...rule,
                runtimeStatus: rule.status,
              }
            : rule,
        ),
      )

      await sleep(120)
    }
  }, [])

  const runRulesEngine = async () => {
    setIsRunningValidation(true)
    setHasRunValidation(false)
    const nextFindings: ValidationPanelFinding[] = []
    const precheckRules: Array<Omit<AnimatedRuleResult, "runtimeStatus">> = []

    try {
      const blockingStepIssues: Array<{ step: number; count: number }> = []
      for (const step of [2, 3, 4, 5, 6, 7]) {
        const stepErrors = validateStep(step)
        const errorCount = Object.keys(stepErrors).length
        if (errorCount > 0) {
          blockingStepIssues.push({ step, count: errorCount })
        }
      }

      if (blockingStepIssues.length > 0) {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_REQUIRED_FIELDS",
          label: "Required Fields Completion",
          status: "fail",
          fixStep: blockingStepIssues[0]?.step ?? 2,
          fixLabel: `Step ${blockingStepIssues[0]?.step ?? 2}`,
          message: `Missing required fields: ${blockingStepIssues
            .map((item) => `Step ${item.step}: ${item.count} issue${item.count > 1 ? "s" : ""}`)
            .join(" | ")}`,
        })
        nextFindings.push({
          source: "precheck",
          code: "STEP_VALIDATION_BLOCKED",
          level: "error",
          message: precheckRules[precheckRules.length - 1]?.message ?? "Required fields are missing.",
        })
      } else {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_REQUIRED_FIELDS",
          label: "Required Fields Completion",
          status: "pass",
          message: "All required fields are complete across Steps 2-7.",
        })
      }

      const expectedCount = clampPersonCount(state.data.contact.p1_num_people || 1)
      if (state.data.persons.length !== expectedCount) {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_HOUSEHOLD_COUNT",
          label: "Household Count Consistency",
          status: "fail",
          fixStep: 2,
          fixLabel: "Step 2",
          message: `Expected ${expectedCount} person records but found ${state.data.persons.length}.`,
        })
        nextFindings.push({
          source: "precheck",
          code: "HOUSEHOLD_COUNT_MISMATCH",
          level: "error",
          message: `Expected ${expectedCount} person records but found ${state.data.persons.length}.`,
        })
      } else {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_HOUSEHOLD_COUNT",
          label: "Household Count Consistency",
          status: "pass",
          message: `Household count matches (${expectedCount} person record${expectedCount > 1 ? "s" : ""}).`,
        })
      }

      const applyingCount = state.data.persons.filter(
        (person) => String(person.coverage.applying_for_coverage ?? "") === "Yes",
      ).length
      if (applyingCount === 0) {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_COVERAGE_REQUEST",
          label: "Coverage Request",
          status: "warning",
          fixStep: 6,
          fixLabel: "Step 6",
          message: "No household member is marked as applying for coverage.",
        })
        nextFindings.push({
          source: "precheck",
          code: "NO_COVERAGE_APPLICANTS",
          level: "warning",
          message: "No one is applying for coverage. Confirm this is expected before submission.",
        })
      } else {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_COVERAGE_REQUEST",
          label: "Coverage Request",
          status: "pass",
          message: `${applyingCount} household member${applyingCount > 1 ? "s are" : " is"} applying for coverage.`,
        })
      }

      if (!nextFindings.some((finding) => finding.level === "error")) {
        const eligibilityInput = mapWizardToEligibilityInput(state.data, apiIncomeVerified)
        const result = evaluateAca3Eligibility(eligibilityInput)
        setEligibilityResult(result)

        for (const finding of result.findings) {
          nextFindings.push({
            source: "engine",
            ...finding,
          })
        }

        await animateRules([
          ...precheckRules,
          ...result.rule_results.map((ruleResult) => ({
            ...ruleResult,
            source: "engine" as const,
            fixStep: getEngineRuleFixTarget(ruleResult.id)?.step,
            fixLabel: getEngineRuleFixTarget(ruleResult.id)?.label,
          })),
        ])
      } else {
        setEligibilityResult(null)
        await animateRules(precheckRules)
      }

      if (!nextFindings.some((finding) => finding.level === "error")) {
        nextFindings.push({
          source: "precheck",
          code: "VALIDATION_READY",
          level: "success",
          message: "Validation completed. Review result and submit when ready.",
        })
      }
    } finally {
      setFindings(nextFindings)
      setHasRunValidation(true)
      setIsRunningValidation(false)
    }
  }

  const hasBlockingErrors = findings.some((finding) => finding.level === "error")
  const statusBlocksSubmission =
    eligibilityResult?.status === "DENIED" || eligibilityResult?.status === "REDIRECT_ACA2"
  const canSubmit = hasRunValidation && !hasBlockingErrors && !statusBlocksSubmission && state.data.attestation && identityVerified
  const allRulesPassed =
    hasRunValidation &&
    !isRunningValidation &&
    animatedRules.length > 0 &&
    animatedRules.every((rule) => rule.runtimeStatus === "pass")

  useEffect(() => {
    if (!hasRunValidation) {
      setRulePanelOpen(true)
      return
    }

    setRulePanelOpen(!allRulesPassed)
  }, [allRulesPassed, hasRunValidation])

  return (
    <StepContainer
      title="Validate & Submit"
      description="Run MassHealth validation rules before final submission."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onBackToReview}>
          Back to Review
        </Button>
        <Button type="button" onClick={runRulesEngine} disabled={isRunningValidation}>
          {isRunningValidation ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              Running Validation...
            </span>
          ) : (
            "Run Validation"
          )}
        </Button>
      </div>

      {animatedRules.length > 0 ? (
        <Card>
          <Collapsible open={rulePanelOpen} onOpenChange={setRulePanelOpen}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Rule Execution</CardTitle>
                  <CardDescription>
                    {allRulesPassed
                      ? "All rules passed. Expand to view full execution details."
                      : "Rules ran in sequence with pass/fail status and fix links."}
                  </CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    {rulePanelOpen ? "Collapse" : "Expand"}
                    <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", rulePanelOpen ? "rotate-180" : "")} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-2">
                {animatedRules.map((rule) => (
                  <div
                    key={`${rule.source}-${rule.id}`}
                    className={cn(
                      "rounded-md border p-3 text-sm transition-colors",
                      rule.runtimeStatus === "pending" && "border-muted bg-muted/30 text-muted-foreground",
                      rule.runtimeStatus === "running" && "border-sky-500/40 bg-sky-500/10 text-sky-800",
                      rule.runtimeStatus === "pass" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
                      rule.runtimeStatus === "fail" && "border-destructive/40 bg-destructive/10 text-destructive",
                      rule.runtimeStatus === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-800",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{rule.label}</p>
                        <p>{rule.message}</p>
                        {(rule.runtimeStatus === "fail" || rule.runtimeStatus === "warning") && rule.fixStep ? (
                          <div className="pt-1">
                            <Button type="button" size="sm" variant="link" className="h-auto px-0" onClick={() => onGoToStep(rule.fixStep!)}>
                              Fix in Step {rule.fixStep}: {rule.fixLabel ?? "Go to step"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0">
                        {rule.runtimeStatus === "running" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium">
                            <Spinner className="size-3.5" />
                            RUNNING
                          </span>
                        ) : (
                          <span className="text-xs font-medium uppercase">{rule.runtimeStatus}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ) : null}

      {hasRunValidation ? (
        <div className="space-y-3">
          {findings.map((finding, index) => (
            <div
              key={`${finding.source}-${finding.code}-${index}`}
              className={cn(
                "rounded-md border p-3 text-sm",
                finding.level === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
                finding.level === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-800",
                finding.level === "info" && "border-sky-500/40 bg-sky-500/10 text-sky-800",
                finding.level === "success" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
              )}
            >
              <p className="font-medium">{finding.code}</p>
              <p className="mt-1">{finding.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Validation has not been run yet.
        </p>
      )}

      {eligibilityResult ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Eligibility Engine Result</CardTitle>
            <CardDescription>Computed from ACA-3 data and MassHealth rule set.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Applicant ID:</span> {eligibilityResult.applicant_id}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span> {eligibilityResult.status}
            </div>
            <div>
              <span className="text-muted-foreground">Program:</span> {eligibilityResult.eligible_program}
            </div>
            <div>
              <span className="text-muted-foreground">Household size:</span> {eligibilityResult.household_size}
            </div>
            <div>
              <span className="text-muted-foreground">MAGI income:</span> ${eligibilityResult.income.toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">FPL percent:</span> {eligibilityResult.fpl_percent}%
            </div>
            <div className="md:col-span-2">
              <span className="text-muted-foreground">Required documents:</span>{" "}
              {eligibilityResult.required_documents.length > 0
                ? eligibilityResult.required_documents.join(", ")
                : "None"}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {statusBlocksSubmission ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Submission is blocked because the current result status is {eligibilityResult?.status}.
        </div>
      ) : null}

      {/* Income proof upload — shown whenever applicationId is available */}
      {applicationId ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Income Proof Documents</CardTitle>
            </div>
            <CardDescription>
              Upload supporting documents for each income source. Verified documents strengthen your application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeEvidenceChecklist
              applicationId={applicationId}
              householdMembers={state.data.persons.map((p, i) => {
                const income = p.income as Record<string, unknown> | undefined
                const jobs = Array.isArray(income?.employment_jobs) ? income!.employment_jobs as Array<Record<string, unknown>> : []
                const other = (income?.other_income as Record<string, { selected?: boolean }>) ?? {}
                const sources: string[] = []
                if (jobs.length > 0) sources.push("employment")
                if (income?.self_employment_net_income) sources.push("self_employment")
                if (other.unemployment?.selected) sources.push("unemployment")
                if (other.social_security?.selected) sources.push("social_security")
                if (other.pension_annuity?.selected) sources.push("pension_annuity")
                if (other.rental?.selected) sources.push("rental")
                if (other.interest_dividend?.selected) sources.push("interest_dividend")
                const hasIncome = sources.length > 0
                if (!hasIncome) sources.push("zero_income")
                return {
                  memberId: getIncomeChecklistMemberId(applicationId, i),
                  memberName: String(p.identity?.name ?? "") || (i === 0 ? String(state.data.contact.p1_name ?? "") : `Member ${i + 1}`),
                  incomeSources: sources as import("@/lib/masshealth/types").IncomeSourceType[],
                  hasIncome,
                }
              })}
              onCaseUpdated={(updatedCase) => {
                // apiIncomeVerified is refreshed from the API on the next poll;
                // for immediate feedback update context state via a dispatch if needed
                void updatedCase
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
        <Checkbox
          checked={state.data.attestation}
          onCheckedChange={(checked) =>
            dispatch({ type: "set_attestation", payload: Boolean(checked) })
          }
        />
        <span>I attest that the information provided is true and complete to the best of my knowledge.</span>
      </label>

      {/* Identity verification hard gate */}
      {!identityVerified && !state.submitted && (
        <IdentityVerificationBanner className="w-full" />
      )}

      <Button
        type="button"
        className="w-full"
        disabled={!canSubmit || state.submitted}
        onClick={() => {
          if (!identityVerified) {
            reduxDispatch(openScanner())
            return
          }
          setSubmitAcknowledged(false)
          setSubmitDialogOpen(true)
        }}
        title={!identityVerified ? "Identity verification is required before submitting" : undefined}
      >
        {state.submitted ? "Application Submitted" : "Submit Application"}
      </Button>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Disclaimer</DialogTitle>
            <DialogDescription>
              Please review and acknowledge before final submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900">
              By submitting, you confirm the application data is accurate to the best of your knowledge and understand
              that false or incomplete information can delay processing, require additional documents, or affect eligibility.
            </div>

            <label className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox checked={submitAcknowledged} onCheckedChange={(checked) => setSubmitAcknowledged(Boolean(checked))} />
              <span>I acknowledge this disclaimer and authorize submission of this application.</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!submitAcknowledged}
              onClick={async () => {
                const submittedState: WizardState = {
                  ...state,
                  submitted: true,
                  dirty: false,
                  errors: {},
                }
                dispatch({ type: "set_submitted", payload: true })
                dispatch({ type: "set_dirty", payload: false })
                reduxDispatch(markApplicationSubmitted({ applicationId }))
                await saveDraftNow(submittedState)
                setSubmitDialogOpen(false)
              }}
            >
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {state.submitted ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Application submitted after validation.
        </div>
      ) : null}
    </StepContainer>
  )
}
