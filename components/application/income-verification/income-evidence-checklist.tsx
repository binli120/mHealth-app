"use client"

/**
 * IncomeEvidenceChecklist
 *
 * Renders the per-member, per-source document upload interface built from
 * the evidence requirements returned by /api/masshealth/income-verification/checklist.
 *
 * Each income source gets its own upload slot so documents stay associated
 * with the right source — not dropped into an undifferentiated bucket.
 *
 * Upload flow:
 *   1. User picks file for a specific source.
 *   2. POST to /api/masshealth/income-verification/documents → returns jobId.
 *   3. POST to /api/masshealth/income-verification/extract   → async extraction.
 *   4. GET  /api/masshealth/income-verification/:applicationId → refresh status.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"
import type {
  IncomeEvidenceRequirement,
  IncomeVerificationCase,
  IncomeVerificationStatus,
  IncomeDocType,
  IncomeChecklistMember,
} from "@/lib/masshealth/types"

// ── Label maps ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<IncomeDocType, string> = {
  pay_stub:               "Recent Pay Stub (within 45 days)",
  employer_statement:     "Employer Statement",
  tax_return:             "Federal Tax Return",
  w2:                     "W-2 Form",
  form_1099:              "1099 Form",
  profit_loss_statement:  "Profit & Loss Statement",
  self_employment_form:   "Self-Employment Verification Form",
  unemployment_letter:    "Unemployment Benefits Letter",
  social_security_letter: "Social Security Award Letter",
  pension_statement:      "Pension / Annuity Statement",
  rental_agreement:       "Rental Agreement or Lease",
  interest_statement:     "Interest / Dividend Statement",
  zero_income_affidavit:  "Zero-Income Affidavit",
  attestation_form:       "Attestation Form",
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  employment:        "Employment Income",
  self_employment:   "Self-Employment Income",
  tax_return:        "Tax-Based Income (Return)",
  w2:                "W-2 Income",
  form_1099:         "1099 Income",
  unemployment:      "Unemployment Benefits",
  social_security:   "Social Security / SSA",
  pension_annuity:   "Pension or Annuity",
  rental:            "Rental Income",
  interest_dividend: "Interest / Dividend Income",
  zero_income:       "No Income (Zero-Income Declaration)",
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IncomeVerificationStatus }) {
  const config: Record<IncomeVerificationStatus, { label: string; className: string; icon: React.ReactNode }> = {
    verified: {
      label: "Verified",
      className: "bg-green-100 text-green-800 border-green-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    needs_clarification: {
      label: "Needs Clarification",
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
      icon: <AlertCircle className="h-3 w-3" />,
    },
    needs_additional_document: {
      label: "Additional Document Needed",
      className: "bg-orange-100 text-orange-800 border-orange-200",
      icon: <XCircle className="h-3 w-3" />,
    },
    manual_review: {
      label: "Manual Review",
      className: "bg-purple-100 text-purple-800 border-purple-200",
      icon: <Clock className="h-3 w-3" />,
    },
    attested_pending_review: {
      label: "Attestation Submitted",
      className: "bg-blue-100 text-blue-800 border-blue-200",
      icon: <Clock className="h-3 w-3" />,
    },
    pending: {
      label: "Documents Needed",
      className: "bg-gray-100 text-gray-700 border-gray-200",
      icon: <Upload className="h-3 w-3" />,
    },
  }

  const { label, className, icon } = config[status] ?? config.pending

  return (
    <Badge variant="outline" className={cn("flex items-center gap-1 text-xs font-medium", className)}>
      {icon}
      {label}
    </Badge>
  )
}

// ── Single requirement row ────────────────────────────────────────────────────

interface RequirementRowProps {
  requirement:   IncomeEvidenceRequirement
  applicationId: string
  onUploaded:    () => void
}

function RequirementRow({ requirement, applicationId, onUploaded }: RequirementRowProps) {
  const [expanded, setExpanded]   = useState(requirement.verificationStatus === "pending")
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [fileName, setFileName]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setError(null)
      setUploading(true)
      setFileName(file.name)

      try {
        // 1. Upload the file
        const uploadForm = new FormData()
        uploadForm.set("file", file)
        uploadForm.set("applicationId", applicationId)
        uploadForm.set("memberId", requirement.memberId)
        uploadForm.set("docTypeClaimed", requirement.acceptedDocTypes[0] ?? "attestation_form")

        const uploadResp = await authenticatedFetch(
          "/api/masshealth/income-verification/documents",
          { method: "POST", body: uploadForm },
        )

        if (!uploadResp.ok) {
          const body = (await uploadResp.json()) as { error?: string }
          throw new Error(body.error ?? "Upload failed.")
        }

        const { documentId } = (await uploadResp.json()) as { documentId: string }

        // 2. Kick off async extraction (fire-and-forget; recompute handles the rest)
        const extractForm = new FormData()
        extractForm.set("file", file)
        extractForm.set("documentId", documentId)
        extractForm.set("applicationId", applicationId)
        extractForm.set("memberId", requirement.memberId)
        extractForm.set("docTypeClaimed", requirement.acceptedDocTypes[0] ?? "attestation_form")
        extractForm.set("memberName", requirement.memberName)

        // Non-blocking — the recompute endpoint will be called on next poll/refresh
        void authenticatedFetch("/api/masshealth/income-verification/extract", {
          method: "POST",
          body: extractForm,
        })

        onUploaded()
      } catch (err) {
        setError(toUserFacingError(err, { fallback: "Upload failed. Please try again.", context: "upload" }))
        setFileName(null)
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [applicationId, requirement, onUploaded],
  )

  const isComplete =
    requirement.verificationStatus === "verified" ||
    requirement.verificationStatus === "attested_pending_review"

  return (
    <div className={cn(
      "rounded-lg border bg-card transition-colors",
      isComplete ? "border-green-200 bg-green-50/30" : "border-border",
    )}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {SOURCE_TYPE_LABELS[requirement.incomeSourceType] ?? requirement.incomeSourceType}
          </span>
          <span className="text-xs text-muted-foreground">{requirement.memberName}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={requirement.verificationStatus} />
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Accepted documents for this income source:
          </p>
          <ul className="mb-4 space-y-1">
            {requirement.acceptedDocTypes.map((dt) => (
              <li key={dt} className="flex items-center gap-2 text-sm">
                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                {DOC_TYPE_LABELS[dt] ?? dt}
              </li>
            ))}
          </ul>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {fileName && !error && (
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {fileName} uploaded — extraction in progress
            </div>
          )}

          {!isComplete && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface IncomeEvidenceChecklistProps {
  applicationId:    string
  householdMembers: IncomeChecklistMember[]
  /** Called with the latest case after each refresh so parent can update incomeVerified. */
  onCaseUpdated?:   (verificationCase: IncomeVerificationCase) => void
}

export function IncomeEvidenceChecklist({
  applicationId,
  householdMembers,
  onCaseUpdated,
}: IncomeEvidenceChecklistProps) {
  const [requirements, setRequirements] = useState<IncomeEvidenceRequirement[]>([])
  const [caseStatus, setCaseStatus]     = useState<string>("pending_documents")
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const fetchCase = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `/api/masshealth/income-verification/${applicationId}`,
      )
      if (!resp.ok) return
      const { ok: _ok, ...verificationCase } = (await resp.json()) as IncomeVerificationCase & { ok: boolean }
      setRequirements(verificationCase.requirements ?? [])
      setCaseStatus(verificationCase.status)
      onCaseUpdated?.(verificationCase)
    } catch {
      // Silently retry — user-visible error is handled on initial load
    }
  }, [applicationId, onCaseUpdated])

  // Build checklist on mount then fetch current state
  useEffect(() => {
    if (!applicationId || householdMembers.length === 0) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      try {
        const resp = await authenticatedFetch(
          "/api/masshealth/income-verification/checklist",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicationId, householdMembers }),
          },
        )

        if (!cancelled) {
          if (resp.ok) {
            const data = (await resp.json()) as { requirements: IncomeEvidenceRequirement[]; caseStatus: string }
            setRequirements(data.requirements ?? [])
            setCaseStatus(data.caseStatus ?? "pending_documents")
          } else {
            setError("Unable to load the income document checklist. Please try again.")
          }
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load the income document checklist. Please try again.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()
    return () => { cancelled = true }
  }, [applicationId, householdMembers])

  // Refresh case after any upload
  const handleUploaded = useCallback(async () => {
    await fetchCase()
  }, [fetchCase])

  // Group requirements by member
  const byMember = requirements.reduce<Record<string, IncomeEvidenceRequirement[]>>(
    (acc, req) => {
      const key = req.memberId
      if (!acc[key]) acc[key] = []
      acc[key].push(req)
      return acc
    },
    {},
  )

  const verifiedCount = requirements.filter((r) => r.verificationStatus === "verified").length
  const totalRequired = requirements.filter((r) => r.isRequired).length

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading income document checklist…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        {error}
      </div>
    )
  }

  if (requirements.length === 0) {
    return (
      <div className="rounded-md border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        No income documents are required for this household.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {verifiedCount} of {totalRequired} income source{totalRequired !== 1 ? "s" : ""} verified
        </p>
        {caseStatus === "verified" && (
          <Badge className="bg-green-100 text-green-800 border-green-200 border">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Income Verified
          </Badge>
        )}
      </div>

      {/* Per-member sections */}
      {Object.entries(byMember).map(([memberId, reqs]) => {
        const memberName = reqs[0]?.memberName ?? memberId
        return (
          <Card key={memberId}>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm font-semibold">{memberName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {reqs.map((req) => (
                <RequirementRow
                  key={req.id}
                  requirement={req}
                  applicationId={applicationId}
                  onUploaded={handleUploaded}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
