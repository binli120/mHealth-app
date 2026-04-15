/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Scale,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  FileSearch,
  Download,
  Paperclip,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageIntro } from "@/components/shared/PageIntro"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import { ErrorCard } from "@/components/shared/ErrorCard"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSafeSupabaseSession, getSafeSupabaseUser } from "@/lib/supabase/client"
import { useDocumentUpload } from "@/hooks/use-document-upload"
import {
  ACCEPTED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_UPLOAD_BYTES,
} from "@/lib/appeals/constants"
import {
  buildAppealDraftFilename,
  buildAppealDraftPrefill,
  buildAppealDraftWordHtml,
  fillAppealDraftPlaceholders,
} from "@/lib/appeals/draft-personalization"
import type { UserProfile } from "@/lib/user-profile/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryEntry {
  code: string
  label: string
  description: string
  notice_keywords: string[]
  evidence_needed: string[]
  argument_themes: string[]
  missing_info_questions: string[]
}

interface MatchedCategory {
  code: string
  label: string
  score: number
  rationale: string
}

type TrustTier = "official" | "legal_aid" | "community"

interface TopSource {
  source_id: string
  title: string
  url: string
  source_type: string
  trust_tier: TrustTier
  score: number
  summary: string
  key_points: string[]
}

interface ResearchResult {
  status: string
  matched_categories: MatchedCategory[]
  evidence_checklist: string[]
  argument_themes: string[]
  missing_information_questions: string[]
  top_sources: TopSource[]
  grounding_warnings: string[]
}

interface DraftResult {
  status: string
  letter_text: string
  citations: Array<{
    source_id: string
    title: string
    trust_tier: string
    excerpt: string
  }>
  model_used: string
  error: string
}

type PageState =
  | "form"
  | "researching"
  | "research_results"
  | "drafting"
  | "draft_result"
  | "error"

interface PrefilledAppealFields {
  applicantName: string
  contactInformation: string
  householdSummary: string
}

// ─── Auth sentinel ────────────────────────────────────────────────────────────

/** Thrown by masshealthFetch when there is no valid session. Caught by the page
 *  component which then redirects to login rather than showing an error card. */
class AuthNeededError extends Error {
  constructor() { super("auth-needed") }
}

const LOGIN_PATH = "/auth/login"
const THIS_PATH  = "/masshealth-appeals"
const ACCEPTED_MIME_STRING = [...ACCEPTED_DOCUMENT_MIME_TYPES].join(",")

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function masshealthFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { session, error } = await getSafeSupabaseSession()
  if (error || !session) throw new AuthNeededError()

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${session.access_token}`)
  headers.set("user-id", session.user.id)
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(url, { ...init, headers })
}

const TRUST_TIER_CLASSES: Record<TrustTier, string> = {
  official: "bg-blue-100 text-blue-800",
  legal_aid: "bg-emerald-100 text-emerald-800",
  community: "bg-amber-100 text-amber-800",
}

function trustBadge(tier: string) {
  const cls = TRUST_TIER_CLASSES[tier as TrustTier] ?? "bg-gray-100 text-gray-700"
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {tier.replace("_", " ")}
    </span>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MassHealthAppealsPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>("form")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [prefilledFields, setPrefilledFields] = useState<PrefilledAppealFields>({
    applicantName: "",
    contactInformation: "",
    householdSummary: "",
  })

  // Step 1 — research form
  const [categories, setCategories] = useState<CategoryEntry[]>([])
  const [denialText, setDenialText] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const {
    state: documentState,
    fileInputRef,
    handleFile,
    clear: clearUploadedDocument,
  } = useDocumentUpload({
    extractEndpoint: "/api/appeals/extract-document",
    maxBytes: MAX_DOCUMENT_UPLOAD_BYTES,
  })

  // Step 2 — research result + draft details
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null)
  const [applicantName, setApplicantName] = useState("")
  const [contactInformation, setContactInformation] = useState("")
  const [applicantId, setApplicantId] = useState("")
  const [householdSummary, setHouseholdSummary] = useState("")
  const [facts, setFacts] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" },
  ])

  // Step 3 — draft result
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null)
  const [copied, setCopied] = useState(false)

  /** Redirect to login, preserving this page as the post-login destination. */
  const goToLogin = useCallback(() => {
    router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(THIS_PATH)}`)
  }, [router])

  // ── Guard: redirect to login if there is no active session ───────────────
  useEffect(() => {
    void (async () => {
      const { session } = await getSafeSupabaseSession()
      if (!session) goToLogin()
    })()
  }, [goToLogin])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const [{ user }, profileResult] = await Promise.all([
          getSafeSupabaseUser(),
          authenticatedFetch("/api/user-profile", { cache: "no-store" })
            .then(async (res) => {
              if (!res.ok) return null
              const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; profile?: UserProfile }
              return payload.ok ? (payload.profile ?? null) : null
            })
            .catch(() => null),
        ])

        if (cancelled) return

        const userMeta = user?.user_metadata as Record<string, unknown> | undefined
        const prefill = buildAppealDraftPrefill({
          profile: profileResult,
          email: user?.email ?? null,
          sessionFirstName: typeof userMeta?.first_name === "string" ? userMeta.first_name : null,
          sessionLastName: typeof userMeta?.last_name === "string" ? userMeta.last_name : null,
        })

        setPrefilledFields(prefill)
        setApplicantName((current) => current || prefill.applicantName)
        setContactInformation((current) => current || prefill.contactInformation)
        setHouseholdSummary((current) => current || prefill.householdSummary)
      } catch {
        // Non-fatal — the draft form stays editable without profile hydration.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (documentState.status !== "ready") return

    const extractedText = documentState.extractedText.trim()
    if (extractedText) setDenialText(extractedText)
  }, [documentState])

  // Load categories on mount (non-fatal if it fails)
  useEffect(() => {
    void (async () => {
      try {
        const res = await masshealthFetch("/api/masshealth/appeals/categories")
        if (res.ok) {
          setCategories((await res.json()) as CategoryEntry[])
        }
      } catch {
        // categories are optional — skip silently
      }
    })()
  }, [])

  // ── Step 1 → research ────────────────────────────────────────────────────

  async function handleResearch() {
    if (denialText.trim().length < 20) return
    setPageState("researching")
    setErrorMessage(null)

    try {
      const res = await masshealthFetch("/api/masshealth/appeals/research", {
        method: "POST",
        body: JSON.stringify({
          denial_notice_text: denialText,
          issue_category: selectedCategory || null,
          top_k: 5,
        }),
      })

      if (res.status === 401) { goToLogin(); return }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(err.detail ?? `Server error ${res.status}`)
      }

      setResearchResult((await res.json()) as ResearchResult)
      setPageState("research_results")
    } catch (e) {
      if (e instanceof AuthNeededError) { goToLogin(); return }
      setErrorMessage(e instanceof Error ? e.message : "Failed to analyze denial notice")
      setPageState("error")
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void handleFile(file)
  }

  // ── Step 2 → draft ───────────────────────────────────────────────────────

  async function handleDraft() {
    if (!researchResult) return
    setPageState("drafting")
    setErrorMessage(null)

    const factsObj: Record<string, string> = {}
    for (const { key, value } of facts) {
      if (key.trim() && value.trim()) factsObj[key.trim()] = value.trim()
    }
    if (contactInformation.trim()) {
      factsObj["Contact information"] = contactInformation.trim()
    }

    try {
      const res = await masshealthFetch("/api/masshealth/appeals/draft", {
        method: "POST",
        body: JSON.stringify({
          denial_notice_text: denialText,
          applicant_name: applicantName || undefined,
          applicant_id: applicantId || undefined,
          household_summary: householdSummary || undefined,
          facts: Object.keys(factsObj).length > 0 ? factsObj : undefined,
          top_k: 5,
        }),
      })

      if (res.status === 401) { goToLogin(); return }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          detail?: string
          error?: string
        }
        throw new Error(err.detail ?? err.error ?? `Server error ${res.status}`)
      }

      const data = (await res.json()) as DraftResult
      if (data.error) throw new Error(data.error)
      setDraftResult(data)
      setPageState("draft_result")
    } catch (e) {
      if (e instanceof AuthNeededError) { goToLogin(); return }
      setErrorMessage(e instanceof Error ? e.message : "Failed to generate appeal letter")
      setPageState("error")
    }
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  function handleReset() {
    setPageState("form")
    setDenialText("")
    setSelectedCategory("")
    clearUploadedDocument()
    setResearchResult(null)
    setDraftResult(null)
    setErrorMessage(null)
    setApplicantName(prefilledFields.applicantName)
    setContactInformation(prefilledFields.contactInformation)
    setApplicantId("")
    setHouseholdSummary(prefilledFields.householdSummary)
    setFacts([{ key: "", value: "" }])
    setCopied(false)
  }

  async function handleCopy() {
    if (!draftResult) return
    await navigator.clipboard.writeText(resolvedDraftText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownloadText() {
    if (!draftResult) return
    triggerDownload(
      new Blob([resolvedDraftText], { type: "text/plain;charset=utf-8" }),
      `${buildAppealDraftFilename(applicantName)}.txt`,
    )
  }

  function handleDownloadWord() {
    if (!draftResult) return
    triggerDownload(
      new Blob([buildAppealDraftWordHtml(resolvedDraftText)], { type: "application/msword;charset=utf-8" }),
      `${buildAppealDraftFilename(applicantName)}.doc`,
    )
  }

  function addFact() {
    setFacts((prev) => [...prev, { key: "", value: "" }])
  }

  function updateFact(index: number, field: "key" | "value", value: string) {
    setFacts((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    )
  }

  function removeFact(index: number) {
    setFacts((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const resolvedDraftText = draftResult
    ? fillAppealDraftPlaceholders(draftResult.letter_text, {
      applicantName,
      contactInformation,
    })
    : ""

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backHref="/customer/dashboard"
        backLabel="Dashboard"
        breadcrumbs={[{ label: "MassHealth Appeal Assistant" }]}
        maxWidth="max-w-3xl"
      />

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Intro — shown on entry and while researching */}
        {(pageState === "form" || pageState === "researching") && (
          <PageIntro
            icon={<Scale className="h-6 w-6 text-red-600" />}
            iconBg="bg-red-100"
            title="MassHealth Appeal Assistant"
            description="Paste your denial notice to get a tailored evidence checklist, legal arguments, and a draft appeal letter — grounded in MassHealth regulations and legal aid resources."
          />
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {pageState === "error" && (
          <ErrorCard
            title="Something went wrong"
            message={errorMessage ?? "An unexpected error occurred"}
            onRetry={() => setPageState(researchResult ? "research_results" : "form")}
            retryLabel="Go Back"
          />
        )}

        {/* ── Step 1: Form ──────────────────────────────────────────────── */}
        {pageState === "form" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analyze Your Denial Notice</CardTitle>
              <CardDescription>
                Upload a PDF notice or paste the text from your MassHealth denial letter to begin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>
                  Denial Notice PDF{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload a PDF, JPEG, PNG, or WEBP denial notice. The extracted text will fill the
                  notice box below.
                </p>

                {documentState.status === "idle" && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_MIME_STRING}
                      className="sr-only"
                      id="denial-notice-upload"
                      onChange={handleFileChange}
                    />
                    <Label
                      htmlFor="denial-notice-upload"
                      className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      Upload denial notice PDF
                    </Label>
                  </div>
                )}

                {documentState.status === "extracting" && (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-700">
                        {documentState.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">Reading document text...</p>
                    </div>
                  </div>
                )}

                {documentState.status === "ready" && (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-emerald-800">
                          {documentState.fileName}
                        </p>
                        <button
                          type="button"
                          onClick={clearUploadedDocument}
                          className="shrink-0 text-emerald-600 hover:text-emerald-800"
                          aria-label="Remove uploaded notice"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {documentState.extractedText.trim() ? (
                        <p className="text-xs text-emerald-700">
                          Document text extracted and added below.
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700">
                          No readable text was found. Paste the notice text below.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {documentState.status === "error" && (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-destructive">
                          {documentState.fileName}
                        </p>
                        <button
                          type="button"
                          onClick={clearUploadedDocument}
                          className="shrink-0 text-destructive/70 hover:text-destructive"
                          aria-label="Dismiss upload error"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-destructive/80">{documentState.message}</p>
                    </div>
                  </div>
                )}

                {documentState.status !== "idle" && documentState.status !== "extracting" && (
                  <button
                    type="button"
                    onClick={clearUploadedDocument}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Choose another file
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="denial-text">
                  Denial Notice Text <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="denial-text"
                  placeholder="Upload a PDF above or paste the full text of your denial notice here..."
                  value={denialText}
                  onChange={(e) => setDenialText(e.target.value)}
                  rows={8}
                  className="resize-none font-mono text-sm"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {denialText.length} chars
                  {denialText.length > 0 && denialText.trim().length < 20 && (
                    <span className="text-destructive"> (min 20)</span>
                  )}
                </p>
              </div>

              {categories.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Denial Category{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional — helps narrow results)
                    </span>
                  </Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Auto-detect from notice text" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => void handleResearch()}
                disabled={denialText.trim().length < 20 || documentState.status === "extracting"}
              >
                <FileSearch className="mr-2 h-4 w-4" />
                Analyze Denial Notice
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Loading: researching ───────────────────────────────────────── */}
        {pageState === "researching" && (
          <LoadingSkeleton blocks={["h-6 w-56", "h-28", "h-40", "h-32"]} />
        )}

        {/* ── Step 2: Research results + draft form ─────────────────────── */}
        {pageState === "research_results" && researchResult && (
          <div className="space-y-5">
            {/* Matched categories */}
            {researchResult.matched_categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Matched Denial Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {researchResult.matched_categories.map((cat) => (
                    <div
                      key={cat.code}
                      className="rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(cat.score * 100)}% match
                        </Badge>
                      </div>
                      {cat.rationale && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cat.rationale}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Evidence checklist */}
            {researchResult.evidence_checklist.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evidence Checklist</CardTitle>
                  <CardDescription>
                    Gather these documents to support your appeal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {researchResult.evidence_checklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Argument themes */}
            {researchResult.argument_themes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Key Arguments</CardTitle>
                  <CardDescription>Legal grounds for your appeal</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {researchResult.argument_themes.map((theme, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {theme}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Top sources */}
            {researchResult.top_sources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Relevant Sources</CardTitle>
                  <CardDescription>
                    Regulations and resources that will be cited in your letter
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {researchResult.top_sources.map((src) => (
                    <div
                      key={src.source_id}
                      className="space-y-1.5 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{src.title}</span>
                          {trustBadge(src.trust_tier)}
                        </div>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {src.summary}
                      </p>
                      {src.key_points.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {src.key_points.map((pt, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              · {pt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Grounding warnings */}
            {researchResult.grounding_warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium">Notes</p>
                <ul className="mt-1 space-y-0.5">
                  {researchResult.grounding_warnings.map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* ── Draft details form ─────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generate Your Appeal Letter</CardTitle>
                <CardDescription>
                  Fill in your details for a personalized letter. All fields are optional.
                  <span className="mt-1 block font-medium text-amber-700">
                    Letter generation typically takes 30–90 seconds.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="applicant-name">Full Name</Label>
                    <Input
                      id="applicant-name"
                      placeholder="Maria Santos"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="applicant-id">MassHealth ID</Label>
                    <Input
                      id="applicant-id"
                      placeholder="MH-2026-000000"
                      value={applicantId}
                      onChange={(e) => setApplicantId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="household">Household Summary</Label>
                  <Input
                    id="household"
                    placeholder="Single adult, age 38"
                    value={householdSummary}
                    onChange={(e) => setHouseholdSummary(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-information">Contact Information</Label>
                  <Textarea
                    id="contact-information"
                    placeholder={"123 Main St\nBoston, MA 02118\n(617) 555-1212\nmaria@example.com"}
                    value={contactInformation}
                    onChange={(e) => setContactInformation(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to fill placeholders like [YOUR CONTACT INFORMATION] in the final letter.
                  </p>
                </div>

                {/* Dynamic key-value facts */}
                <div className="space-y-2">
                  <Label>Key Facts</Label>
                  <p className="text-xs text-muted-foreground">
                    Specific numbers the letter should mention — income, savings, etc.
                  </p>
                  {facts.map((fact, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Monthly income"
                        value={fact.key}
                        onChange={(e) => updateFact(i, "key", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="$1,150"
                        value={fact.value}
                        onChange={(e) => updateFact(i, "value", e.target.value)}
                        className="flex-1"
                      />
                      {facts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFact(i)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove fact"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addFact}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add fact
                  </Button>
                </div>

                <Button className="w-full" onClick={() => void handleDraft()}>
                  <Scale className="mr-2 h-4 w-4" />
                  Generate Appeal Letter
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Loading: drafting ──────────────────────────────────────────── */}
        {pageState === "drafting" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-14">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Drafting your appeal letter…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This typically takes 30–90 seconds. Please keep this tab open.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Draft result ───────────────────────────────────────── */}
        {pageState === "draft_result" && draftResult && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Your Appeal Letter</CardTitle>
                    <CardDescription>
                      Generated by {draftResult.model_used} · Review carefully before
                      sending.
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleDownloadWord}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Word
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadText}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Text
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCopy()}
                    >
                      {copied ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[36rem] overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {resolvedDraftText}
                </pre>
              </CardContent>
            </Card>

            {/* Citations */}
            {draftResult.citations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sources Cited</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {draftResult.citations.map((cit, i) => (
                    <div key={cit.source_id} className="flex gap-3 text-sm">
                      <span className="w-5 shrink-0 text-muted-foreground">{i + 1}.</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{cit.title}</span>
                          {trustBadge(cit.trust_tier)}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {cit.excerpt}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Button variant="outline" className="w-full" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
