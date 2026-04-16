/**
 * Constants for the Admin Users page.
 * @author Bin Lee
 */

export const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "applicant", label: "Applicant" },
  { value: "social_worker", label: "Social Worker" },
  { value: "reviewer", label: "Reviewer" },
  { value: "read_only_staff", label: "Read-Only Staff" },
  { value: "case_reviewer", label: "Case Reviewer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "admin", label: "Admin" },
]

export const ROLE_COLORS: Record<string, string> = {
  admin:           "bg-red-100 text-red-700",
  supervisor:      "bg-amber-100 text-amber-700",
  reviewer:        "bg-purple-100 text-purple-700",
  case_reviewer:   "bg-violet-100 text-violet-700",
  social_worker:   "bg-blue-100 text-blue-700",
  read_only_staff: "bg-slate-100 text-slate-600",
  applicant:       "bg-gray-100 text-gray-600",
}
