/**
 * Constants for the Social Worker Patient Dashboard page.
 * @author Bin Lee
 */

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react"
import type { ApplicationStatus } from "@/lib/application-status"

export const STATUS_META: Record<ApplicationStatus, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: "In Progress", color: "bg-secondary text-secondary-foreground", icon: FileText },
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary", icon: Clock },
  ai_extracted: { label: "AI Extracted", color: "bg-accent/10 text-accent", icon: Clock },
  needs_review: { label: "Needs Review", color: "bg-accent/10 text-accent", icon: Clock },
  rfi_requested: { label: "Info Requested", color: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle2 },
  denied: { label: "Denied", color: "bg-destructive/10 text-destructive", icon: AlertCircle },
}
