/**
 * Permission keys and role defaults for the HealthCompass MA admin portal.
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

// ── All permission keys ───────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Applications
  APPLICATIONS_VIEW:   "applications.view",
  APPLICATIONS_EDIT:   "applications.edit",
  APPLICATIONS_DELETE: "applications.delete",
  APPLICATIONS_EXPORT: "applications.export",

  // Users
  USERS_VIEW:   "users.view",
  USERS_EDIT:   "users.edit",
  USERS_INVITE: "users.invite",
  USERS_BULK:   "users.bulk",

  // Reports
  REPORTS_VIEW:   "reports.view",
  REPORTS_EXPORT: "reports.export",

  // Organizations
  ORGANIZATIONS_VIEW: "organizations.view",
  ORGANIZATIONS_EDIT: "organizations.edit",

  // Social Workers
  SOCIAL_WORKERS_VIEW: "social_workers.view",
  SOCIAL_WORKERS_EDIT: "social_workers.edit",

  // Admin
  ADMIN_ROLES:    "admin.roles",
  ADMIN_SESSIONS: "admin.sessions",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ── Grouped for UI display ────────────────────────────────────────────────────

export type PermissionGroup = {
  label: string
  permissions: { key: Permission; label: string; description: string }[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Applications",
    permissions: [
      { key: "applications.view",   label: "View",   description: "Read applications and status" },
      { key: "applications.edit",   label: "Edit",   description: "Update application data and status" },
      { key: "applications.delete", label: "Delete", description: "Delete or archive applications" },
      { key: "applications.export", label: "Export", description: "Export application data to CSV" },
    ],
  },
  {
    label: "Users",
    permissions: [
      { key: "users.view",   label: "View",   description: "View user accounts and profiles" },
      { key: "users.edit",   label: "Edit",   description: "Edit user details and activate/deactivate" },
      { key: "users.invite", label: "Invite", description: "Send email invitations to new users" },
      { key: "users.bulk",   label: "Bulk",   description: "Bulk import, deactivate, or assign roles" },
    ],
  },
  {
    label: "Reports",
    permissions: [
      { key: "reports.view",   label: "View",   description: "Access analytics and report dashboards" },
      { key: "reports.export", label: "Export", description: "Download report data as CSV" },
    ],
  },
  {
    label: "Organizations",
    permissions: [
      { key: "organizations.view", label: "View", description: "View company/org records" },
      { key: "organizations.edit", label: "Edit", description: "Create and update organizations" },
    ],
  },
  {
    label: "Social Workers",
    permissions: [
      { key: "social_workers.view", label: "View", description: "View social worker profiles" },
      { key: "social_workers.edit", label: "Edit", description: "Manage social worker assignments" },
    ],
  },
  {
    label: "Admin",
    permissions: [
      { key: "admin.roles",    label: "Roles",    description: "Manage roles and permissions" },
      { key: "admin.sessions", label: "Sessions", description: "View sessions and force logout users" },
    ],
  },
]

// ── Default permission sets per role ─────────────────────────────────────────

export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS) as Permission[],
  reviewer: [
    "applications.view",
    "users.view",
    "reports.view",
    "organizations.view",
    "social_workers.view",
  ],
  read_only_staff: [
    "applications.view",
    "users.view",
    "organizations.view",
    "social_workers.view",
  ],
  case_reviewer: [
    "applications.view",
    "users.view",
    "reports.view",
    "organizations.view",
    "social_workers.view",
  ],
  supervisor: [
    "applications.view",
    "applications.edit",
    "users.view",
    "users.edit",
    "users.invite",
    "reports.view",
    "reports.export",
    "organizations.view",
    "organizations.edit",
    "social_workers.view",
    "social_workers.edit",
  ],
  social_worker: [
    "applications.view",
    "applications.edit",
    "organizations.view",
    "social_workers.view",
  ],
  applicant: [],
}
