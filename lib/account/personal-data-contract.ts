export const PERSONAL_DATA_CONFIRMATION_PHRASE = "DELETE ALL DATA"

export interface PersonalDataResetContext {
  applicationIds: string[]
  storagePaths: string[]
}

/** Every application table must have an explicit reset disposition. */
export const PERSONAL_DATA_TABLE_CLASSIFICATION = {
  organizations: "shared", roles: "shared", companies: "shared", users: "preserve",
  user_roles: "preserve", applicants: "delete", applications: "delete",
  household_members: "delete", incomes: "delete", assets: "delete", documents: "delete",
  document_pages: "delete", document_extractions: "delete", validation_results: "delete",
  eligibility_screenings: "delete", review_actions: "delete", rfis: "delete", audit_logs: "delete",
  policy_documents: "shared", policy_chunks: "shared", collaborative_sessions: "delete",
  session_messages: "delete", social_worker_profiles: "shared", patient_social_worker_access: "delete",
  notifications: "delete", invitations: "shared", user_profiles: "delete", family_profiles: "delete",
  benefit_stack_results: "delete", sw_engagement_requests: "delete", sw_direct_messages: "delete",
  identity_verification_attempts: "delete", mobile_verify_sessions: "delete",
  income_verification_cases: "delete", income_evidence_requirements: "delete",
  income_documents: "delete", income_document_extractions: "delete",
  income_verification_decisions: "delete", income_rfi_events: "delete", revoked_sessions: "delete",
  admin_passkey_credentials: "shared", growth_referrals: "shared", mailing_list_signups: "shared",
  role_permissions: "shared", login_events: "delete", admin_settings: "shared",
  mobile_upload_sessions: "delete", user_passkey_credentials: "preserve", appeal_analyses: "delete",
  user_agent_memory: "delete", rate_limit_counters: "delete", insurance_coverage_records: "delete",
  insurance_explanations: "delete", glossary_terms: "shared", help_questions: "delete",
  help_answers: "delete", mobile_handoff_sessions: "delete",
} as const satisfies Record<string, "delete" | "preserve" | "shared">

export const CASCADE_DELETED_TABLES = [
  "household_members", "incomes", "assets", "documents", "document_pages",
  "document_extractions", "validation_results", "eligibility_screenings",
  "user_profiles", "family_profiles", "benefit_stack_results",
  "identity_verification_attempts", "mobile_verify_sessions", "income_verification_cases",
  "income_evidence_requirements", "income_documents", "income_document_extractions",
  "income_verification_decisions", "income_rfi_events", "insurance_explanations",
  "session_messages",
] as const
