/**
 * TypeScript types for the Customer Profile page.
 * @author Bin Lee
 */

import type { ElementType } from "react"
import type { UserProfile } from "@/lib/user-profile/types"

export type SectionId = "personal" | "family" | "education" | "bank" | "settings" | "notifications"

export interface ProfileNavItem {
  id: SectionId
  label: string
  icon: ElementType
}

export interface UserProfileApiResponse {
  ok: boolean
  profile?: UserProfile
  error?: string
}
