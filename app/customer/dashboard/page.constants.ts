/**
 * Constants for the Customer Dashboard page.
 * @author Bin Lee
 */

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import type { DashboardStatus } from "./page.types"

export const STATUS_META: Record<DashboardStatus, { color: string; icon: typeof FileText }> = {
  draft: { color: "bg-secondary text-secondary-foreground", icon: FileText },
  submitted: { color: "bg-primary/10 text-primary", icon: Clock },
  ai_extracted: { color: "bg-accent/10 text-accent", icon: Clock },
  needs_review: { color: "bg-accent/10 text-accent", icon: Clock },
  rfi_requested: { color: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { color: "bg-success/10 text-success", icon: CheckCircle2 },
  denied: { color: "bg-destructive/10 text-destructive", icon: AlertCircle },
}

export const APPLICATION_TYPE_LABELS = new Map<string, string>(
  MASSHEALTH_APPLICATION_TYPES.map((item) => [item.id, item.shortLabel]),
)
