/**
 * Shared social worker constants.
 * @author Bin Lee
 */

import {
  APPLICATION_STATUS_BADGE_STYLES,
  APPLICATION_STATUS_LABELS,
} from "@/lib/application-status"
import type { SocialWorkerPatientStatusFilter } from "@/lib/social-worker/types"

export const SOCIAL_WORKER_PATIENT_STATUS_STYLES = APPLICATION_STATUS_BADGE_STYLES

export const SOCIAL_WORKER_PATIENT_STATUS_FILTER_OPTIONS: Array<{ value: SocialWorkerPatientStatusFilter; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: APPLICATION_STATUS_LABELS.draft },
  { value: "submitted", label: APPLICATION_STATUS_LABELS.submitted },
  { value: "needs_review", label: APPLICATION_STATUS_LABELS.needs_review },
  { value: "approved", label: APPLICATION_STATUS_LABELS.approved },
  { value: "denied", label: APPLICATION_STATUS_LABELS.denied },
  { value: "rfi_requested", label: APPLICATION_STATUS_LABELS.rfi_requested },
  { value: "no_applications", label: "No Applications" },
]

export const SOCIAL_WORKER_CITIZENSHIP_LABELS: Record<string, string> = {
  citizen: "US Citizen",
  permanent_resident: "Permanent Resident",
  refugee: "Refugee",
  asylum_seeker: "Asylum Seeker",
  visa_holder: "Visa Holder",
  undocumented: "Undocumented",
}
