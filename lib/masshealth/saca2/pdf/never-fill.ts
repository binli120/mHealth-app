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

  // Person 2's pages (form pages 7-11, PDF indexes 8-12)
  "12 County_P2": { reason: "other", note: "Q12 under Person 2's mailing address; the wizard has no mailing county question (same as Person 1's `15 County`)" },
  "Alien number_P2": {
    reason: "other",
    note: "WIZARD GAP, not a deliberate skip: Person 2's 23b asks a noncitizen for the alien number on the immigration document, but the wizard asks the alien number only for naturalized citizens (same as Person 1's `Alien number_2`); add a wizard question or decide at Task 13",
  },

  // Step 5 (form pages 12-15, PDF indexes 14-16): lines the wizard has no question for
  "Insurance company_PBP": { reason: "other", note: "WIZARD GAP: prepaid burial (You) life-insurance company; the burial rows hold only owner, type and amount" },
  "Policy number_PBP": { reason: "other", note: "WIZARD GAP: prepaid burial (You) life-insurance policy number; the burial rows hold only owner, type and amount" },
  "Bank name_PBP": { reason: "other", note: "WIZARD GAP: prepaid burial (You) burial-only account bank; the burial rows hold only owner, type and amount" },
  "Account number_PBP": { reason: "other", note: "WIZARD GAP: prepaid burial (You) burial-only account number; the burial rows hold only owner, type and amount" },
  "Insurance company_PBP_2": { reason: "other", note: "WIZARD GAP: prepaid burial (Your spouse) life-insurance company; the burial rows hold only owner, type and amount" },
  "Policy number_PBP_2": { reason: "other", note: "WIZARD GAP: prepaid burial (Your spouse) life-insurance policy number; the burial rows hold only owner, type and amount" },
  "Bank name_PBP_2": { reason: "other", note: "WIZARD GAP: prepaid burial (Your spouse) burial-only account bank; the burial rows hold only owner, type and amount" },
  "Account number_PBP_2": { reason: "other", note: "WIZARD GAP: prepaid burial (Your spouse) burial-only account number; the burial rows hold only owner, type and amount" },
  "Mobile home address": {
    reason: "other",
    note: "WIZARD GAP: vehicles (You) mobile-home address; the wizard has one 'year, make, and model (or mobile home address)' answer, written to the Year/make/model line",
  },
  "Mobile home address_2": {
    reason: "other",
    note: "WIZARD GAP: vehicles (Your spouse) mobile-home address; the wizard has one 'year, make, and model (or mobile home address)' answer, written to the Year/make/model line",
  },

  // Step 8 (form page 18, PDF index 19)
  "eligibility as if you do not need PCA services": {
    reason: "other",
    note: "Stray text widget over the continuation of the printed Step 8 paragraph (\"...we will determine your MassHealth eligibility as if you do not need PCA services.\"); the form asks nothing here, so there is no wizard question",
  },

  // Step 10 (form pages 23-24, PDF indexes 24-25): the signature block, and
  // phone lines the wizard has no question for
  "Print name": {
    reason: "signature",
    note: "Printed name of the signer in the signature block (form p.24); the signer may be the applicant, an authorized representative or a responsible party, and signs and prints it by hand",
  },
  Date: {
    reason: "signature-date",
    note: "Date of the signature (form p.24); the person dates it when signing, never pre-filled",
  },
  "Ext._S": { reason: "other", note: "WIZARD GAP: responsible party phone extension; the wizard has no extension question" },
  "Ext._S_2": { reason: "other", note: "WIZARD GAP: responsible party second phone extension; the wizard has no extension question" },
  "Second Phone type_S": {
    reason: "other",
    note: "WIZARD GAP: responsible party second phone type; the wizard asks the phone type only for the first phone",
  },
}
