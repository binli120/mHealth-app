"use client"

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Send, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

interface CaseActionsProps {
  applicationId: string
  status: string
  defaultProgram: string | null
}

interface ApiErrorBody {
  error?: string
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody
    return body.error || "Reviewer action failed."
  } catch {
    return "Reviewer action failed."
  }
}

function dueDateFromDays(days: string): string {
  const date = new Date()
  date.setDate(date.getDate() + Number(days))
  return date.toISOString().slice(0, 10)
}

export function CaseActions({ applicationId, status, defaultProgram }: CaseActionsProps) {
  const router = useRouter()
  const [approveOpen, setApproveOpen] = useState(false)
  const [denyOpen, setDenyOpen] = useState(false)
  const [rfiOpen, setRfiOpen] = useState(false)
  const [program, setProgram] = useState(defaultProgram ?? "masshealth-standard")
  const [approveNotes, setApproveNotes] = useState("")
  const [denyReason, setDenyReason] = useState("income")
  const [denyNotes, setDenyNotes] = useState("")
  const [rfiMessage, setRfiMessage] = useState("")
  const [rfiDeadlineDays, setRfiDeadlineDays] = useState("14")
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isFinal = status === "approved" || status === "denied"
  const rfiDueDate = useMemo(() => dueDateFromDays(rfiDeadlineDays), [rfiDeadlineDays])

  async function submitDecision(decision: "approved" | "denied", event: FormEvent) {
    event.preventDefault()
    setSubmitting(decision)
    setError(null)
    setMessage(null)

    const response = await authenticatedFetch(`/api/reviewer/applications/${applicationId}/decision`, {
      method: "POST",
      body: JSON.stringify({
        decision,
        program: decision === "approved" ? program : null,
        reason: decision === "denied" ? denyReason : null,
        notes: decision === "approved" ? approveNotes : denyNotes,
      }),
    })

    setSubmitting(null)

    if (!response.ok) {
      setError(await parseError(response))
      return
    }

    setApproveOpen(false)
    setDenyOpen(false)
    setMessage(decision === "approved" ? "Application approved." : "Application denied.")
    router.refresh()
  }

  async function submitRfi(event: FormEvent) {
    event.preventDefault()
    setSubmitting("rfi")
    setError(null)
    setMessage(null)

    const response = await authenticatedFetch(`/api/reviewer/applications/${applicationId}/rfi`, {
      method: "POST",
      body: JSON.stringify({
        message: rfiMessage,
        dueDate: rfiDueDate,
      }),
    })

    setSubmitting(null)

    if (!response.ok) {
      setError(await parseError(response))
      return
    }

    setRfiOpen(false)
    setMessage("Request for information sent.")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-2 bg-success text-success-foreground hover:bg-success/90"
              disabled={Boolean(submitting) || status === "approved"}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(event) => void submitDecision("approved", event)}>
              <DialogHeader>
                <DialogTitle>Approve Application</DialogTitle>
                <DialogDescription>Record the final approval decision for this case.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="program">Program Assignment</Label>
                  <Select value={program} onValueChange={setProgram}>
                    <SelectTrigger id="program">
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masshealth-standard">MassHealth Standard</SelectItem>
                      <SelectItem value="careplus">MassHealth CarePlus</SelectItem>
                      <SelectItem value="family-assistance">Family Assistance</SelectItem>
                      <SelectItem value="commonhealth">CommonHealth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-notes">Notes</Label>
                  <Textarea
                    id="approve-notes"
                    value={approveNotes}
                    onChange={(event) => setApproveNotes(event.target.value)}
                    placeholder="Optional approval notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  disabled={submitting === "approved"}
                >
                  Confirm Approval
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
              disabled={Boolean(submitting) || status === "denied"}
            >
              <XCircle className="h-4 w-4" />
              Deny
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(event) => void submitDecision("denied", event)}>
              <DialogHeader>
                <DialogTitle>Deny Application</DialogTitle>
                <DialogDescription>Record the final denial reason for this case.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="denial-reason">Denial Reason</Label>
                  <Select value={denyReason} onValueChange={setDenyReason}>
                    <SelectTrigger id="denial-reason">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income Over Limit</SelectItem>
                      <SelectItem value="residency">Not MA Resident</SelectItem>
                      <SelectItem value="citizenship">Citizenship Ineligible</SelectItem>
                      <SelectItem value="missing-information">Missing Information</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deny-notes">Explanation</Label>
                  <Textarea
                    id="deny-notes"
                    value={denyNotes}
                    onChange={(event) => setDenyNotes(event.target.value)}
                    placeholder="Add denial explanation"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDenyOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={submitting === "denied"}>
                  Confirm Denial
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={rfiOpen} onOpenChange={setRfiOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={Boolean(submitting) || isFinal}>
              <Send className="h-4 w-4" />
              Request Info
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(event) => void submitRfi(event)}>
              <DialogHeader>
                <DialogTitle>Request Additional Information</DialogTitle>
                <DialogDescription>Send an RFI and move the application to RFI requested.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="rfi-message">Message</Label>
                  <Textarea
                    id="rfi-message"
                    required
                    value={rfiMessage}
                    onChange={(event) => setRfiMessage(event.target.value)}
                    placeholder="Describe the documents or clarification needed"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rfi-deadline">Response Deadline</Label>
                  <Select value={rfiDeadlineDays} onValueChange={setRfiDeadlineDays}>
                    <SelectTrigger id="rfi-deadline">
                      <SelectValue placeholder="Select deadline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRfiOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting === "rfi"}>
                  Send Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
