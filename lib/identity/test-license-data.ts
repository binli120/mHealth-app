/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Synthetic Massachusetts driver license used for scanner testing only.
 *
 * The identity matches the seeded demo applicant (demo.e2e@masshealth-test.local,
 * see e2e/fixtures/demo-data.ts) so a successful scan scores 100 and lands in
 * the "verified" bucket. Consumed by scripts/generate-test-license.ts and the
 * round-trip unit test.
 */

import type { ApplicantProfile } from "./verify-license"

/** Demo applicant profile the test license must match (DEMO_USER + DEMO_APPLICATION). */
export const TEST_LICENSE_PROFILE: ApplicantProfile = {
  firstName: "Maria",
  lastName: "Santos",
  dateOfBirth: "1991-03-15",
  addressStreet: "123 Main St",
  addressCity: "Boston",
  addressState: "MA",
  addressZip: "02101",
}

/** Card-face values that don't take part in verification. */
export const TEST_LICENSE_CARD = {
  licenseNumber: "S12345678",
  issueDate: "01/01/2024",
  expirationDate: "01/01/2030",
  sex: "F",
  eyes: "BRO",
  height: "5-04",
} as const

/**
 * Build the AAMVA DL/ID raw barcode payload (version 09, MMDDYYYY dates).
 *
 * Header: @\n\x1e\rANSI <IIN:6><AAMVAver:2><JurVer:2><NumEntries:2>DL<offset:4><length:4>DL
 *   IIN 636002 = Massachusetts
 */
export function buildTestLicensePayload(): string {
  return [
    "@",
    "\x1e\rANSI 636002090102DL00410284DL",
    `DAQ${TEST_LICENSE_CARD.licenseNumber}`,
    `DCS${TEST_LICENSE_PROFILE.lastName.toUpperCase()}`,
    `DAC${TEST_LICENSE_PROFILE.firstName.toUpperCase()}`,
    "DADNONE",
    "DBC2", // sex: 2 = female
    "DBB03151991", // DOB (MMDDYYYY)
    "DBA01012030", // expiry
    "DBD01012024", // issue
    `DAG${TEST_LICENSE_PROFILE.addressStreet.toUpperCase()}`,
    `DAI${TEST_LICENSE_PROFILE.addressCity.toUpperCase()}`,
    `DAJ${TEST_LICENSE_PROFILE.addressState}`,
    "DAK021010000 ", // ZIP padded per AAMVA
    "DCGUSA",
    `DAU504`, // height
    `DAY${TEST_LICENSE_CARD.eyes}`,
    "DDEN",
    "DDFN",
    "DDGN",
  ].join("\n")
}
