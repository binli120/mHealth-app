/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

// ── Program group mapping ─────────────────────────────────────────────────────

export type GroupKey = "MassHealth" | "ConnectorCare" | "Medicare" | "Employer"

export const CODE_TO_GROUP: Record<string, GroupKey> = {
  careplus:                          "MassHealth",
  masshealth_standard:               "MassHealth",
  pregnancy_standard:                "MassHealth",
  dual_eligible_standard:            "MassHealth",
  family_assistance_chip:            "MassHealth",
  masshealth_commonhealth:           "MassHealth",
  masshealth_limited:                "MassHealth",
  connectorcare_1:                   "ConnectorCare",
  connectorcare_2:                   "ConnectorCare",
  connectorcare_3:                   "ConnectorCare",
  federal_tax_credits:               "ConnectorCare",
  employer_or_connector:             "ConnectorCare",
  health_connector_child_plans:      "ConnectorCare",
  medicare:                          "Medicare",
  medicare_advantage:                "Medicare",
  medicare_savings_program_adult:    "Medicare",
  medigap_plans:                     "Medicare",
  employer_sponsored_insurance:      "Employer",
  marketplace_bronze:                "Employer",
  marketplace_silver:                "Employer",
  marketplace_gold:                  "Employer",
}

export const GROUP_ORDER: GroupKey[] = ["MassHealth", "ConnectorCare", "Medicare", "Employer"]

export const GROUP_COLORS: Record<GroupKey, string> = {
  MassHealth:    "#2563eb",   // blue   — state Medicaid program
  ConnectorCare: "#16a34a",   // green  — marketplace/subsidized plans
  Medicare:      "#dc2626",   // red    — federal Medicare
  Employer:      "#9333ea",   // purple — employer / unsubsidized marketplace
}
