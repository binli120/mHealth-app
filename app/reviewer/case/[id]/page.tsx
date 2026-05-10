/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getReviewerCase, type ReviewerCaseDetail } from "@/lib/db/reviewer"
import { ShieldHeartIcon } from "@/lib/icons"

import {
  ConfidenceBadge,
  ReviewerStatusBadge,
  formatApplicationType,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
} from "../../_components/reviewer-ui"
import { requireReviewerPage } from "../../page-auth"
import { CaseActions } from "./CaseActions"
import type { PageProps } from "./page.types"

interface ExtractedField {
  field: string
  value: string
  source: string
  confidence: number | null
}

interface WarningItem {
  severity: "high" | "medium" | "low"
  field: string
  message: string
}

function getDraftValue(state: Record<string, unknown> | null, path: string[]): string | null {
  let cursor: unknown = state
  for (const segment of path) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) return null
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  if (cursor === null || cursor === undefined) return null
  const value = String(cursor).trim()
  return value || null
}

function compactAddress(caseItem: ReviewerCaseDetail): string | null {
  const { line1, line2, city, state, zip } = caseItem.applicantAddress
  const street = [line1, line2].filter(Boolean).join(" ")
  const locality = [city, state, zip].filter(Boolean).join(", ")
  return [street, locality].filter(Boolean).join(" - ") || null
}

function buildExtractedFields(caseItem: ReviewerCaseDetail): ExtractedField[] {
  const draftName = getDraftValue(caseItem.draftState, ["data", "contact", "p1_name"])
  const address = compactAddress(caseItem)
  const fields: Array<ExtractedField | null> = [
    {
      field: "Applicant",
      value: draftName ?? caseItem.applicantName,
      source: draftName ? "Application draft" : "Applicant profile",
      confidence: caseItem.confidenceScore,
    },
    caseItem.applicantDob
      ? { field: "Date of Birth", value: caseItem.applicantDob, source: "Applicant profile", confidence: null }
      : null,
    caseItem.applicantEmail
      ? { field: "Email", value: caseItem.applicantEmail, source: "Applicant account", confidence: null }
      : null,
    caseItem.applicantPhone
      ? { field: "Phone", value: caseItem.applicantPhone, source: "Applicant profile", confidence: null }
      : null,
    address ? { field: "Address", value: address, source: "Applicant profile", confidence: null } : null,
    caseItem.householdSize !== null
      ? {
          field: "Household Size",
          value: String(caseItem.householdSize),
          source: "Application record",
          confidence: caseItem.confidenceScore,
        }
      : null,
    caseItem.totalMonthlyIncome !== null
      ? {
          field: "Monthly Income",
          value: `${formatCurrency(caseItem.totalMonthlyIncome)}/mo`,
          source: "Application record",
          confidence: caseItem.confidenceScore,
        }
      : null,
    caseItem.fplPercentage !== null
      ? {
          field: "FPL Level",
          value: `${Math.round(caseItem.fplPercentage)}%`,
          source: "Eligibility screening",
          confidence: caseItem.confidenceScore,
        }
      : null,
    caseItem.estimatedProgram
      ? {
          field: "Estimated Program",
          value: caseItem.estimatedProgram,
          source: "Eligibility screening",
          confidence: caseItem.confidenceScore,
        }
      : null,
    caseItem.citizenshipStatus
      ? {
          field: "Citizenship Status",
          value: caseItem.citizenshipStatus,
          source: "Applicant profile",
          confidence: null,
        }
      : null,
    ...caseItem.documents
      .filter((document) => document.analysisDocumentType)
      .map((document) => ({
        field: "Document Classification",
        value: document.analysisDocumentType as string,
        source: document.fileName ?? document.requiredDocumentLabel ?? "Uploaded document",
        confidence: document.extractionConfidence,
      })),
  ]

  return fields.filter((field): field is ExtractedField => Boolean(field))
}

function buildWarnings(caseItem: ReviewerCaseDetail): WarningItem[] {
  const warnings: WarningItem[] = caseItem.validationResults
    .filter((result) => !result.resolved)
    .map((result) => ({
      severity: result.severity === "error" ? "high" : "medium",
      field: result.ruleName ?? "Validation",
      message: result.message,
    }))

  if (caseItem.documentCount === 0) {
    warnings.push({
      severity: "medium",
      field: "Documents",
      message: "No documents are attached to this application.",
    })
  }

  if (caseItem.confidenceScore !== null && caseItem.confidenceScore < 75) {
    warnings.push({
      severity: "medium",
      field: "Confidence",
      message: "Overall confidence is below the reviewer threshold.",
    })
  }

  if (caseItem.status === "rfi_requested") {
    warnings.push({
      severity: "low",
      field: "RFI",
      message: "A request for information is outstanding.",
    })
  }

  return warnings
}

function warningClass(severity: WarningItem["severity"]): string {
  if (severity === "high") return "border-destructive/50 bg-destructive/5"
  if (severity === "medium") return "border-warning/50 bg-warning/5"
  return "border-border bg-secondary/30"
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { id } = await params
  await requireReviewerPage(`/reviewer/case/${id}`)
  const caseItem = await getReviewerCase(id)
  if (!caseItem) notFound()

  const extractedFields = buildExtractedFields(caseItem)
  const warnings = buildWarnings(caseItem)
  const confidenceWidth = `${Math.max(0, Math.min(100, Math.round(caseItem.confidenceScore ?? 0)))}%`

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-sidebar">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/reviewer/cases" className="flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Cases</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">HealthCompass MA</span>
            <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-xs font-medium text-sidebar-accent-foreground">
              Reviewer
            </span>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">{caseItem.displayId}</h1>
              <ReviewerStatusBadge status={caseItem.status} />
              {caseItem.flags.map((flag) => (
                <Badge key={flag} variant="outline" className="bg-secondary/50 text-xs">
                  {flag}
                </Badge>
              ))}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatApplicationType(caseItem.applicationType)} - Submitted {formatDate(caseItem.submittedAt)} - {caseItem.ageDays} days old
            </p>
          </div>
          <Link href="/reviewer/audit">
            <Button variant="outline" size="sm" className="gap-2">
              <History className="h-4 w-4" />
              Audit Log
            </Button>
          </Link>
        </div>
      </div>

      <main className="flex flex-1 flex-col lg:flex-row">
        <section className="flex w-full flex-col border-b border-border lg:w-1/2 lg:border-b-0 lg:border-r">
          <div className="border-b border-border bg-secondary/30 p-4">
            <h2 className="font-semibold text-foreground">Documents</h2>
            <p className="text-sm text-muted-foreground">
              {caseItem.documentCount} uploaded documents - {caseItem.pendingDocumentCount} pending review
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {caseItem.documents.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center">
                <div>
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-4 font-medium text-foreground">No documents uploaded</p>
                  <p className="text-sm text-muted-foreground">Submitted evidence will appear here for reviewer validation.</p>
                </div>
              </div>
            ) : (
              caseItem.documents.map((document) => (
                <Card key={document.id} className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {document.fileName ?? document.requiredDocumentLabel ?? document.documentType ?? "Uploaded document"}
                        </CardTitle>
                        <CardDescription>
                          Uploaded {formatDateTime(document.uploadedAt)} - {formatFileSize(document.fileSizeBytes)}
                        </CardDescription>
                      </div>
                      {document.fileUrl ? (
                        <Link href={document.fileUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-4 w-4" />
                            Open
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{document.documentStatus}</Badge>
                      <Badge variant="outline">{document.validationStatus}</Badge>
                      {document.analysisDocumentType ? (
                        <Badge variant="outline">{document.analysisDocumentType}</Badge>
                      ) : null}
                    </div>
                    {document.validationError ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                        {document.validationError}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        <section className="flex w-full flex-col lg:w-1/2">
          <Tabs defaultValue="extracted" className="flex flex-1 flex-col">
            <TabsList className="mx-4 mt-4 grid grid-cols-4">
              <TabsTrigger value="extracted">Extracted</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="warnings">Warnings</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="extracted" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-card-foreground">Extracted Data</CardTitle>
                    <CardDescription>Data currently available from the application and document analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {extractedFields.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No extracted fields are available for this case.</p>
                    ) : (
                      <div className="space-y-3">
                        {extractedFields.map((item) => (
                          <div key={`${item.field}-${item.source}`} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground">{item.field}</p>
                              <p className="break-words font-medium text-foreground">{item.value}</p>
                              <p className="text-xs text-muted-foreground">Source: {item.source}</p>
                            </div>
                            <ConfidenceBadge value={item.confidence} />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base text-card-foreground">Review Summary</CardTitle>
                    </div>
                    <CardDescription>Current deterministic case facts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Applicant</span>
                        <span className="text-right font-medium text-foreground">{caseItem.applicantName}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Household</span>
                        <span className="font-medium text-foreground">{caseItem.householdSize ?? "Not provided"}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Monthly Income</span>
                        <span className="font-medium text-foreground">{formatCurrency(caseItem.totalMonthlyIncome)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">FPL Level</span>
                        <span className="font-medium text-foreground">
                          {caseItem.fplPercentage !== null ? `${Math.round(caseItem.fplPercentage)}%` : "Not calculated"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-border pt-3">
                        <span className="text-muted-foreground">Estimated Program</span>
                        <span className="text-right font-semibold text-foreground">{caseItem.estimatedProgram ?? "Not assigned"}</span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Overall Confidence</span>
                        <ConfidenceBadge value={caseItem.confidenceScore} />
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: confidenceWidth }} />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          Documents
                        </div>
                        <p className="mt-1 text-xl font-semibold text-foreground">{caseItem.documentCount}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-4 w-4" />
                          Open Validations
                        </div>
                        <p className="mt-1 text-xl font-semibold text-foreground">{caseItem.openValidationCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="warnings" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      <CardTitle className="text-base text-card-foreground">Validation Warnings</CardTitle>
                    </div>
                    <CardDescription>Issues requiring reviewer attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {warnings.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        No open warnings for this case.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {warnings.map((warning, index) => (
                          <div key={`${warning.field}-${index}`} className={`rounded-lg border p-4 ${warningClass(warning.severity)}`}>
                            <div className="flex items-start gap-3">
                              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                              <div>
                                <p className="font-medium text-foreground">{warning.message}</p>
                                <p className="text-sm text-muted-foreground">Field: {warning.field}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base text-card-foreground">Audit Trail</CardTitle>
                    </div>
                    <CardDescription>Case activity from application and audit tables</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {caseItem.auditEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No audit history is available for this case.</p>
                    ) : (
                      <div className="space-y-4">
                        {caseItem.auditEvents.map((entry, index) => (
                          <div key={entry.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                <Clock className="h-4 w-4 text-primary" />
                              </div>
                              {index < caseItem.auditEvents.length - 1 ? (
                                <div className="mt-2 h-full w-0.5 bg-border" />
                              ) : null}
                            </div>
                            <div className="flex-1 pb-4">
                              <p className="font-medium text-foreground">{entry.action}</p>
                              <p className="text-sm text-muted-foreground">
                                {entry.actorEmail ?? entry.actorRole} - {formatDateTime(entry.occurredAt)}
                              </p>
                              <p className="text-sm text-muted-foreground">{entry.details}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            <div className="border-t border-border bg-card p-4">
              <Card className="border-border bg-secondary/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-base text-card-foreground">Decision</CardTitle>
                  <CardDescription>Reviewer actions are recorded to review_actions and audit_logs.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CaseActions
                    applicationId={caseItem.id}
                    status={caseItem.status}
                    defaultProgram={caseItem.estimatedProgram}
                  />
                </CardContent>
              </Card>
            </div>
          </Tabs>
        </section>
      </main>

    </div>
  )
}
