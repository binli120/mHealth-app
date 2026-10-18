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
 * The MassHealth ID boxes (ID_ARD_1 .. ID_ARD_12) printed on each of the three ARD-1122 section pages: one digit per box.
 * WIZARD GAP: the wizard never asks for a MassHealth ID (the page's alternative, the last four SSN digits, is filled).
 */
function ardMassHealthIdBoxes(): Record<string, { reason: NeverFillReason; note: string }> {
  const entries: Array<[string, { reason: NeverFillReason; note: string }]> = []
  for (const [suffix, page] of [["", "Section I (idx 35)"], ["_S2", "Section II (idx 36)"], ["_S3", "Section III (idx 37)"]] as const) {
    for (let n = 1; n <= 12; n += 1) {
      entries.push([
        `ID_ARD_${n}${suffix}`,
        { reason: "other", note: `WIZARD GAP: ARD-1122 ${page} MassHealth ID box ${n} of 12; the wizard has no MassHealth ID question (the last four SSN digits are filled instead)` },
      ])
    }
  }
  return Object.fromEntries(entries)
}

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

  // Supplement A (form pages 25-28, PDF indexes 26-29): the supplement's own signature block
  Date_SuppA_Signature_2: {
    reason: "signature-date",
    note: "Date of the Supplement A signature (form p.28); the person dates it when signing, never pre-filled",
  },
  "Print name_SuppA_Signature_2": {
    reason: "signature",
    note: "Printed name of the Supplement A signer (form p.28); the signer may be the applicant or an authorized representative and signs and prints it by hand",
  },

  // Supplement C (form page 30, PDF index 31): the signature block. The form has no widget on the signature line itself.
  "Print name_SuppC_3": {
    reason: "signature",
    note: "Printed name of the Supplement C signer (form p.30); the signer may be the applicant or an authorized representative and signs and prints it by hand",
  },
  Date_SuppC_3: {
    reason: "signature-date",
    note: "Date of the Supplement C signature (form p.30); the person dates it when signing, never pre-filled",
  },
  // ARD-1122 (form pages 33-36, PDF indexes 34-37), Section I (idx 35): the signature lines
  "ApplicantsMembers signature": {
    reason: "signature",
    note: "Applicant's/Member's signature line of ARD-1122 Section I Part A (name is a garbled label); the applicant signs it by hand",
  },
  Date_ARD: {
    reason: "signature-date",
    note: "Date beside the applicant's signature, ARD-1122 Section I Part A; dated by the applicant when signing, never pre-filled",
  },
  "Authorized representatives signature_ARD": {
    reason: "signature",
    note: "Authorized representative's signature line, ARD-1122 Section I Part B1 (representative is a person); signed by hand by the representative",
  },
  Date_ARD_2: {
    reason: "signature-date",
    note: "Date beside the representative's signature, ARD-1122 Section I Part B1; dated by the representative when signing, never pre-filled",
  },
  "Signature of provider staff member or volunteer completing form_ARD": {
    reason: "signature",
    note: "Signature of the provider, staff member, or volunteer, ARD-1122 Section I Part B2 (representative is an organization); signed by hand by that person",
  },
  Date_ARD_3: {
    reason: "signature-date",
    note: "Date beside the staff member's or volunteer's signature, ARD-1122 Section I Part B2; dated when signing, never pre-filled",
  },
  // Section II (idx 36)
  "Authorized representatives signature_ARD_S2": {
    reason: "signature",
    note: "Authorized representative's signature line, ARD-1122 Section II (applicant cannot designate in writing); signed by hand by the representative",
  },
  Date_ARD_S2: {
    reason: "signature-date",
    note: "Date beside the representative's signature, ARD-1122 Section II; dated by the representative when signing, never pre-filled",
  },
  "Officers Signature_ARD_S2": {
    reason: "signature",
    note: "Officer's signature line, ARD-1122 Section II (officer signs for the organization the representative is affiliated with); signed by hand by the officer",
  },
  Date_ARD_S2_2: {
    reason: "signature-date",
    note: "Date beside the officer's signature, ARD-1122 Section II; dated by the officer when signing, never pre-filled",
  },
  // Section III (idx 37)
  "Authorized representatives signatureApplicants Members Name_ARD_S3": {
    reason: "signature",
    note: "Authorized representative's signature line, ARD-1122 Section III (appointed by law); the template name is a garbled label (signature + applicant name) but the widget sits on the signature line; signed by hand",
  },
  Date_ARD_S3: {
    reason: "signature-date",
    note: "Date beside the representative's signature, ARD-1122 Section III; dated by the representative when signing, never pre-filled",
  },
  // the MassHealth ID boxes on each of the three section pages (generated below)
  ...ardMassHealthIdBoxes(),

  // IRS Form 4506 (form pages 37-38, PDF index 38): lines the wizard has no question for, fee, and the signature block
  "Caution If the tax return is being sent to the third party ensure that lines 5 through 7 are completed before signing see instructions": {
    reason: "other",
    note: "IRS 4506 line 5 (third party name, address and phone; the template name is a shifted label); WIZARD GAP: the wizard does not ask for a third party, and leaving it blank sends the return to the taxpayer",
  },
  "Note If the copies must be certified for court or administrative proceedings check here": {
    reason: "other",
    note: "IRS 4506 line 6 note, certified copies for court; the wizard does not ask (applicants request plain copies of their returns)",
  },
  "8 Fee There is a 43 fee for each return requested Full payment must be included with your request or it will be rejected Make your check or money order payable to United States Treasury Enter your SSN ITIN or EIN and Form 4506 request on your check or money order a Cost for each return                            b Number of returns requested on line 7                       c Total cost Multiply line 8a by line 8b": {
    reason: "other",
    note: "IRS 4506 line 8 fee area (the box beside 8b, number of returns); the fee is paid by the taxpayer to the IRS by check or money order, so the form is not pre-filled with fee amounts and the wizard has no fee question",
  },
  fill_38_2: {
    reason: "other",
    note: "IRS 4506 line 8c total cost box; the fee is paid by the taxpayer to the IRS by check or money order, so the form is not pre-filled with fee amounts and the wizard has no fee question",
  },
  "If we cannot find the tax return we will refund the fee If the refund should go to the third party listed on line 5 check here": {
    reason: "other",
    note: "IRS 4506 line 9 refund-to-third-party check box; depends on the line 5 third party, which the wizard does not collect (see line 5)",
  },
  "execute Form 4506 on behalf of the taxpayer Note This form must be received by IRS within 120 days of the signature date": {
    reason: "consent",
    note: "IRS 4506 signature block: the signatory's attestation check box (read the attestation and has authority to sign); ticked by the signatory when signing, never pre-filled",
  },
  "declares that heshe has the authority to sign the Form 4506 See instructions": {
    reason: "signature-date",
    note: "IRS 4506 signature block: the DATE box above the Date label beside the taxpayer's signature line (the template name is a garbled label, 'authority to sign'); dated by the signer, never pre-filled. The form has no widget on the signature line itself",
  },
  "Phone number of taxpayer on line 1a or 2a": {
    reason: "signature",
    note: "IRS 4506 signature block: the signer's phone number (for the IRS to reach the signer about the signature); belongs to the signature block the signer completes, so it is not pre-filled",
  },
  "Print/Type name": {
    reason: "signature",
    note: "IRS 4506 signature block: printed name of the signer under the taxpayer's signature line; the signer may be someone authorized for the taxpayer, so it is written with the signature, never pre-filled",
  },
  "PrintType name": {
    reason: "signature",
    note: "IRS 4506 signature block: printed name of the spouse under the spouse's signature line; written with the signature, never pre-filled",
  },
}
