/**
 * Constants for the Customer Profile page.
 * @author Bin Lee
 */

import {
  Bell,
  CreditCard,
  GraduationCap,
  Settings,
  User,
  Users,
} from "lucide-react"
import type { ProfileNavItem } from "./page.types"

export const NAV_ITEMS: ProfileNavItem[] = [
  { id: "personal", label: "Personal", icon: User },
  { id: "family", label: "Family & Income", icon: Users },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "bank", label: "Bank", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
]
