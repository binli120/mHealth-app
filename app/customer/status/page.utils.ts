/**
 * Utilities for the Customer Status List page.
 * @author Bin Lee
 */

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react"
import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/application-status"
import { getApplicationTypeLabel as getSharedApplicationTypeLabel } from "@/lib/masshealth/application-types"
import type { StatusFilter } from "./page.types"

export function getStatusConfig(language: SupportedLanguage): Record<ApplicationStatus, { label: string; color: string; icon: typeof FileText }> {
  return {
    draft: { label: getMessage(language, "dashboardStatusDraft"), color: "bg-secondary text-secondary-foreground", icon: FileText },
    submitted: { label: getMessage(language, "dashboardStatusSubmitted"), color: "bg-primary/10 text-primary", icon: Clock },
    ai_extracted: { label: getMessage(language, "dashboardStatusAiExtracted"), color: "bg-accent/10 text-accent", icon: Clock },
    needs_review: { label: getMessage(language, "dashboardStatusNeedsReview"), color: "bg-accent/10 text-accent", icon: Clock },
    rfi_requested: { label: getMessage(language, "dashboardStatusRfiRequested"), color: "bg-warning/10 text-warning", icon: AlertCircle },
    approved: { label: getMessage(language, "dashboardStatusApproved"), color: "bg-success/10 text-success", icon: CheckCircle2 },
    denied: { label: getMessage(language, "dashboardStatusDenied"), color: "bg-destructive/10 text-destructive", icon: AlertCircle },
  }
}

export function getStatusFilterOptions(language: SupportedLanguage): Array<{ value: StatusFilter; label: string }> {
  const statusLabels: Record<ApplicationStatus, string> = {
    draft: getMessage(language, "dashboardStatusDraft"),
    submitted: getMessage(language, "dashboardStatusSubmitted"),
    ai_extracted: getMessage(language, "dashboardStatusAiExtracted"),
    needs_review: getMessage(language, "dashboardStatusNeedsReview"),
    rfi_requested: getMessage(language, "dashboardStatusRfiRequested"),
    approved: getMessage(language, "dashboardStatusApproved"),
    denied: getMessage(language, "dashboardStatusDenied"),
  }

  return [
    { value: "all", label: getMessage(language, "statusListAllStatus") },
    ...APPLICATION_STATUSES.map((status) => ({
      value: status,
      label: statusLabels[status],
    })),
  ]
}

export function getLocalizedApplicationTypeLabel(type: string | null, language: SupportedLanguage): string {
  return getSharedApplicationTypeLabel(type, getMessage(language, "statusListApplicationFallback"))
}
