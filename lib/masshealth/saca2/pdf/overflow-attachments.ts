/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { IRS_YEAR_SLOTS, IRS_YEARS_PATH } from "./derived-attachments"
import { encodeText } from "./encoders"
import type { OverflowCollector } from "./overflow-plan"

/**
 * What the ARD-1122 and IRS 4506 pages cannot hold goes on one sheet, "Authorized representative: additional information":
 * - Section II's organization name: the page has fields for an officer but none for the organization;
 * - Section III's legal document: the page only says to send a copy of the document, with no line to describe it;
 * - Section I with an organization: the representative's email, because Part A has no email line (B1 is for a person).
 * Every read goes through the visible reader, so a hidden ARD or a section that is not the chosen one adds nothing.
 * More years on the IRS 4506 than its two rows of four dates is a mapping bug and throws (counts only).
 */
const text = (raw: unknown): string => encodeText("text", raw) ?? ""

export const attachmentsCollector: OverflowCollector = (reader) => {
  if (reader.rows("irs4506", IRS_YEARS_PATH) > IRS_YEAR_SLOTS) {
    throw new Error(`The IRS 4506 request has more years than the ${IRS_YEAR_SLOTS} date lines of the form`)
  }
  const get = (key: string) => reader.get({ kind: "answer", stepId: "ard", path: `attachments.ard.${key}` })
  const section = get("section")
  const rows: string[][] = []
  if (section === "cannotDesignate" && text(get("orgName")) !== "") {
    rows.push(["Section 2: organization the authorized representative is affiliated with (the form has no line for it)", text(get("orgName"))])
  }
  if (section === "appointedByLaw" && text(get("legalDocument")) !== "") {
    rows.push(["Section 3: legal document that gives the authorized representative authority (send a copy with the form)", text(get("legalDocument"))])
  }
  if (section === "applicantDesignates" && get("repKind") === "organization" && text(get("repEmail")) !== "") {
    rows.push(["Section 1: authorized representative's email address (Part A has no email line)", text(get("repEmail"))])
  }
  return rows.length === 0 ? [] : [{ title: "Authorized representative: additional information", columns: ["Item", "Answer"], rows }]
}
