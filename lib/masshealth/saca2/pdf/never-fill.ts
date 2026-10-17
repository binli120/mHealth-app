/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export type NeverFillReason =
  | "button"
  | "signature"
  | "signature-date"
  | "consent"
  | "office-use"
  | "voter"
  | "other"

/**
 * Fields the generator deliberately never writes. Every entry needs a reason; later tasks add the
 * signature, consent and office-use fields. Keys must be real AcroForm field names.
 */
export const NEVER_FILL: Record<string, { reason: NeverFillReason; note?: string }> = {
  Clear: { reason: "button", note: "Form reset button" },
  Print: { reason: "button", note: "Form print button" },

  // Form page 2 (PDF index 3): questions the wizard does not ask. Decide with the owner at Task 13.
  "15 County": { reason: "other", note: "Mailing address county; the wizard has no mailing county question" },
  "21. Is anyone on this application in prison or jail?": { reason: "other", note: "Q21 (Person 1 block); the wizard has no such question" },
  "If Yes who Enter the name here": { reason: "other", note: "Q21 follow-up (name); the wizard has no such question" },
  "If Yes, is this person awaiting trial?": { reason: "other", note: "Q21 follow-up (awaiting trial); the wizard has no such question" },

  // Form page 2: "FOR ENROLLMENT ASSISTERS ONLY" box, completed by the assister, never by the applicant
  "Navigator or  Certified Application Counselor": { reason: "other", note: "Enrollment assisters only: Navigator / Certified Application Counselor" },
  "First name middle name last name and suffix": { reason: "other", note: "Enrollment assisters only: assister name" },
  "Email address": { reason: "other", note: "Enrollment assisters only: assister email" },
  "Organization name": { reason: "other", note: "Enrollment assisters only: organization name" },
  "Organization identification number": { reason: "other", note: "Enrollment assisters only: organization id" },
  "Organization phone number": { reason: "other", note: "Enrollment assisters only: organization phone" },

  // Form page 4 (PDF index 5)
  "Alien number_2": {
    reason: "other",
    note: "WIZARD GAP, not a deliberate skip: 13b asks a noncitizen for the alien number on the immigration document, but the wizard asks the alien number only for naturalized citizens (Q12); add a wizard question or decide at Task 13",
  },
}
