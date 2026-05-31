/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { ReviewPdfStepProps } from "./types"
import { useFormContext } from "./form-wizard-context"
import { StepContainer } from "./form-wizard-steps"

export function ReviewPdfStep({
  reviewMode,
  onSetReviewMode,
  pdfUrl,
  pdfError,
  isGeneratingPdf,
  pdfStale,
  onGeneratePdf,
  onGoToStep,
  onValidate,
}: ReviewPdfStepProps) {
  const { state } = useFormContext()

  const sections = [
    {
      title: "Program Selection",
      step: 1,
      payload: state.data.preApp,
    },
    {
      title: "Primary Applicant & Household Setup",
      step: 2,
      payload: {
        contact: state.data.contact,
        assisterEnabled: state.data.assisterEnabled,
        assister: state.data.assister,
      },
    },
    {
      title: "Household Members",
      step: 3,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        identity: index === 0 ? "Person 1 identity comes from Step 2" : person.identity,
      })),
    },
    {
      title: "Demographics & SSN",
      step: 4,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        demographics: person.demographics,
        ssn: person.ssn,
      })),
    },
    {
      title: "Tax Filing",
      step: 5,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        tax: person.tax,
      })),
    },
    {
      title: "Coverage & Eligibility",
      step: 6,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        coverage: person.coverage,
      })),
    },
    {
      title: "Income & Deductions",
      step: 7,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        income: person.income,
      })),
    },
  ]

  if (reviewMode === "edit") {
    return (
      <StepContainer title="Review PDF (Edit Mode)" description="Choose a section to edit, then regenerate the PDF preview.">
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={`review-edit-${section.step}`}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription>Step {section.step}</CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onGoToStep(section.step)}>
                  Edit
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="max-h-44 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(section.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={async () => {
              const success = await onGeneratePdf()
              if (success) {
                onSetReviewMode("pdf")
              }
            }}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                Regenerating...
              </span>
            ) : (
              "Regenerate PDF"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => onSetReviewMode("pdf")}>
            Cancel
          </Button>
        </div>
      </StepContainer>
    )
  }

  return (
    <StepContainer
      title="Review PDF"
      description="Preview the filled ACA-03 PDF. Click Edit to change data, then Save to regenerate this preview."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onSetReviewMode("edit")}>
          Edit
        </Button>
        <Button type="button" variant="outline" onClick={onGeneratePdf} disabled={isGeneratingPdf}>
          {isGeneratingPdf ? "Regenerating..." : "Regenerate PDF"}
        </Button>
        {pdfUrl ? (
          <Button type="button" variant="outline" asChild>
            <a href={pdfUrl} download="aca-3-0325-filled.pdf">
              Download PDF
            </a>
          </Button>
        ) : null}
        <Button type="button" onClick={onValidate} disabled={isGeneratingPdf || !pdfUrl || pdfStale}>
          Validate
        </Button>
      </div>

      {pdfStale ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
          Form data changed. Regenerate the PDF before validation.
        </div>
      ) : null}

      {pdfError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {pdfError}
        </div>
      ) : null}

      {!pdfUrl && !isGeneratingPdf ? (
        <Button type="button" onClick={onGeneratePdf}>
          Generate PDF Preview
        </Button>
      ) : null}

      {isGeneratingPdf ? <p className="text-sm text-muted-foreground">Generating PDF preview...</p> : null}

      {pdfUrl ? (
        <div className="overflow-hidden rounded-md border">
          <iframe
            title="ACA-03 PDF preview"
            src={`${pdfUrl}#navpanes=0&view=FitH&zoom=page-fit`}
            className="h-[calc(100vh-220px)] min-h-[720px] w-full"
          />
        </div>
      ) : null}
    </StepContainer>
  )
}

export function getEngineRuleFixTarget(ruleId: string): { step: number; label: string } | null {
  const map: Record<string, { step: number; label: string }> = {
    RULE_01_RESIDENCY: { step: 6, label: "Coverage & Eligibility" },
    RULE_02_IDENTITY: { step: 4, label: "Demographics & SSN" },
    RULE_03_CITIZENSHIP: { step: 6, label: "Coverage & Eligibility" },
    RULE_07_TAX_FILING: { step: 5, label: "Tax Filing" },
    RULE_08_PREGNANCY: { step: 6, label: "Coverage & Eligibility" },
    RULE_09_AGE: { step: 2, label: "Primary Applicant" },
    RULE_10_PROGRAM: { step: 7, label: "Income & Deductions" },
    RULE_11_OTHER_INSURANCE: { step: 6, label: "Coverage & Eligibility" },
    RULE_12_DISABILITY: { step: 6, label: "Coverage & Eligibility" },
    RULE_13_VERIFICATION: { step: 4, label: "Demographics & SSN" },
    RULE_14_FINAL_DECISION: { step: 8, label: "Review PDF" },
  }

  return map[ruleId] ?? null
}
