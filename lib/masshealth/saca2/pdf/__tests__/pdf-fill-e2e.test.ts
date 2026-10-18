/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { PDFDocument } from "pdf-lib"
import { describe, expect, it, vi } from "vitest"

import {
  completeFacilityCouple,
  completeHomeWithAllSupplements,
  completeRichHousehold,
  completeSingleSenior,
} from "../../__tests__/complete-answers"
import type { Saca2Answers } from "../../types"
import { getInventory } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { copyFieldName } from "../page-duplication"
import { PAGE_COPIES, TEMPLATE_PAGE_COUNT, pagesToKeep } from "../page-selection"
import { fillSaca2Pdf } from "../pdf-fill"
import { readFilled, type FilledValues } from "./helpers/read-filled"
import { coupleBoth, job, member } from "./supp-bcd-helpers"

// each fill loads and rewrites the 1.7 MB template; the machine may run many test files in parallel
vi.setConfig({ testTimeout: 180_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
/** A number nobody enters by accident, for stale numeric answers (written as text on the form). */
const STALE_NUMBER = 4242424
const FILL_BUDGET_MS = 5000

// --- tools ------------------------------------------------------------------------------------------

const hasBinary = (binary: string, args: string[]): boolean => !spawnSync(binary, args).error

function withTempPdf<T>(bytes: Uint8Array, run: (file: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "saca2-e2e-"))
  try {
    const file = path.join(dir, "out.pdf")
    writeFileSync(file, bytes)
    return run(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** All page text of a PDF with runs of spaces collapsed, or null (with a message) when pdftotext is not installed. */
function pdfText(bytes: Uint8Array): string | null {
  if (!hasBinary("pdftotext", ["-v"])) {
    console.warn("pdftotext is not installed; skipping the text extraction assertions (CI installs poppler-utils)")
    return null
  }
  return withTempPdf(bytes, (file) => spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).stdout.replace(/[ \t]+/g, " "))
}

// --- the fixtures and what they should produce -----------------------------------------------------

/** The four complete fixtures, plus a household that triggers the copied pages of Supplements B, C and D. */
const FIXTURES: Array<[string, () => Saca2Answers]> = [
  ["completeSingleSenior", completeSingleSenior],
  ["completeFacilityCouple", completeFacilityCouple],
  ["completeRichHousehold", completeRichHousehold],
  ["completeHomeWithAllSupplements", completeHomeWithAllSupplements],
  [
    "a couple with Supplement B, C and D copies",
    () => {
      const a = coupleBoth()
      a.aian.anyMember = "yes"
      a.supplements.b.members = [member(1), member(2), member(3)] as never
      a.health.employerOfferedCoverage = "yes"
      a.supplements.d.jobs = [job(1), job(2)] as never
      return a
    },
  ],
]

/** The copy page's source page (0-based) for a document page index >= TEMPLATE_PAGE_COUNT. */
function sourcePageOfCopy(pageIndex: number): number {
  let index = TEMPLATE_PAGE_COUNT
  for (const spec of PAGE_COPIES) {
    if (pageIndex < index + spec.copies) return spec.source
    index += spec.copies
  }
  throw new Error(`Page ${pageIndex} is not a copy page`)
}

/** Fields the output must hold: the inventory fields with a widget on a kept page, plus the fields of each kept copy page. */
function expectedFieldCount(answers: Saca2Answers): number {
  const keep = pagesToKeep(answers, ON)
  const keptTemplate = new Set(keep.filter((i) => i < TEMPLATE_PAGE_COUNT))
  const inventory = getInventory()
  const template = inventory.filter((f) => f.pages.some((p) => keptTemplate.has(p))).length
  const copies = keep
    .filter((i) => i >= TEMPLATE_PAGE_COUNT)
    .map((i) => inventory.filter((f) => f.pages.length === 1 && f.pages[0] === sourcePageOfCopy(i)).length)
  return template + copies.reduce((sum, n) => sum + n, 0)
}

/** Every NEVER_FILL name, and the names of its copies on the duplicated Supplement B, C and D pages. */
const NEVER_FILL_NAMES = new Set(
  Object.keys(NEVER_FILL).flatMap((name) => [name, ...[1, 2, 3].map((copy) => copyFieldName(name, copy))]),
)

function nonEmpty(values: FilledValues, names: Iterable<string>): string[] {
  const found: string[] = []
  for (const name of names) {
    if (values.text[name] !== undefined) found.push(name)
    else if (values.checks[name] !== undefined && values.checks[name] !== null) found.push(name)
  }
  return found
}

const everything = (values: FilledValues): string => JSON.stringify([values.text, values.checks])

// --- the end-to-end checks on the complete fixtures ------------------------------------------------

describe.each(FIXTURES)("fillSaca2Pdf end to end: %s", (_name, build) => {
  it("fills in time, reloads, holds exactly the expected fields, and writes nothing to a never-fill field", async () => {
    const answers = build()
    const started = performance.now()
    const bytes = await fillSaca2Pdf(answers, null, ON)
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(FILL_BUDGET_MS)

    const doc = await PDFDocument.load(bytes)
    expect(doc.getForm().getFields()).toHaveLength(expectedFieldCount(answers))

    const values = await readFilled(bytes)
    expect(nonEmpty(values, NEVER_FILL_NAMES)).toEqual([])
    // the fill does fill something: Person 1's name is in the name field
    expect(Object.values(values.text).some((v) => v.includes(answers.persons[0].lastName))).toBe(true)
  })

  it("prints Person 1's name and none of a stale sentinel", async () => {
    const answers = build()
    const text = pdfText(await fillSaca2Pdf(answers, null, ON))
    if (text === null) return
    expect(text).toContain(answers.persons[0].firstName)
    expect(text).toContain(answers.persons[0].lastName)
    expect(text).not.toContain(SENTINEL)
  })

  it("is deterministic: filling the same answers twice gives the same field values", async () => {
    const answers = build()
    const first = await readFilled(await fillSaca2Pdf(answers, null, ON))
    const second = await readFilled(await fillSaca2Pdf(answers, null, ON))
    expect(second).toEqual(first)
  })

  it("is a valid PDF for pdfinfo and Ghostscript, with the page count pdf-lib reports", async () => {
    const bytes = await fillSaca2Pdf(build(), null, ON)
    const pages = (await PDFDocument.load(bytes)).getPageCount()
    if (hasBinary("pdfinfo", ["-v"])) {
      const info = withTempPdf(bytes, (file) => spawnSync("pdfinfo", [file], { encoding: "utf8" }))
      expect(info.status, info.stderr).toBe(0)
      expect(info.stderr).toBe("")
      expect(info.stdout.split("\n").find((line) => line.startsWith("Pages:"))?.replace("Pages:", "").trim()).toBe(String(pages))
    } else {
      console.warn("pdfinfo is not installed; skipping the pdfinfo validity check")
    }
    if (hasBinary("gs", ["--version"])) {
      const gs = withTempPdf(bytes, (file) =>
        spawnSync("gs", ["-q", "-dNOPAUSE", "-dBATCH", "-dNOSAFER", "-sDEVICE=nullpage", file], { encoding: "utf8", timeout: 170_000 }),
      )
      expect(gs.status, gs.stderr).toBe(0)
      expect(`${gs.stdout}${gs.stderr}`.trim()).toBe("")
    } else {
      console.warn("gs (Ghostscript) is not installed; skipping the Ghostscript validity check")
    }
  })
})

// --- stale answers behind closed gates, one scenario per gate flip used in the region tests -----------

type Scenario = { name: string; base: () => Saca2Answers; flip: (a: Saca2Answers) => void }

const person = (a: Saca2Answers, index: 0 | 1) => a.persons[index]

const SCENARIOS: Scenario[] = [
  // Task 4: intake and Person 1's first pages
  {
    name: "Person 1 not applying: SSN card name, tax spouse and immigration text",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.applyingForCoverage = "no"
      p.ssnCardName = SENTINEL
      p.tax.spouseName = SENTINEL
      p.immigrationOtherName = SENTINEL
      p.immigrationCountry = SENTINEL
    },
  },
  {
    name: "no SSN: stale card name",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.hasSsn = "no"
      p.noSsnReason = "illness"
      p.nameMatchesSsnCard = "no"
      p.ssnCardName = SENTINEL
    },
  },
  {
    name: "Person 1 not married: stale tax spouse",
    base: completeRichHousehold,
    flip: (a) => {
      person(a, 0).isLegallyMarried = "no"
      person(a, 0).tax.spouseName = SENTINEL
      person(a, 1).relationshipToPerson1 = "wife"
    },
  },
  {
    name: "not in an institution: stale facility name",
    base: completeFacilityCouple,
    flip: (a) => {
      person(a, 0).inInstitution = "no"
      person(a, 0).facilityName = SENTINEL
    },
  },
  {
    name: "no dependents claimed, not claimed as a dependent: stale dependents and tax filer",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.tax.claimsDependents = "no"
      p.tax.dependents = [{ name: SENTINEL, dateOfBirth: "2012-01-01" }]
      p.tax.claimedAsDependent = "no"
      p.tax.taxFiler.name = SENTINEL
    },
  },
  // Task 5: Person 1's pages 4-6
  {
    name: "citizen: stale immigration document, country, other name and alien number",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.usCitizenOrNational = "yes"
      p.naturalizedCitizen = "no"
      p.immigrationDocumentId = SENTINEL
      p.immigrationCountry = SENTINEL
      p.immigrationOtherName = SENTINEL
      p.alienNumber = SENTINEL
      p.citizenshipCertificateNumber = SENTINEL
    },
  },
  {
    name: "no income: stale rows (wages employer, pension description)",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.hasIncome = "no"
      for (const row of p.income) {
        row.employerNameAndAddress = SENTINEL
        row.description = SENTINEL
      }
    },
  },
  {
    name: "wages row changed to pension: stale employer",
    base: completeRichHousehold,
    flip: (a) => {
      const row = person(a, 0).income[0]
      row.kind = "pension"
      row.employerNameAndAddress = SENTINEL
    },
  },
  {
    name: "no rental income and no one-time income: stale units and payments",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.rental.hasRentalIncome = "no"
      p.rental.units[0].address = SENTINEL
      p.oneTimeIncome.thisYear = "no"
      p.oneTimeIncome.thisYearItems[0].type = SENTINEL
      p.oneTimeIncome.nextYear = "no"
      p.oneTimeIncome.nextYearItems[0].type = SENTINEL
    },
  },
  {
    name: "deductions none: stale amounts",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.deductions.none = true
      p.deductions.amounts.hsa = STALE_NUMBER
      p.deductions.amounts.ira = STALE_NUMBER
    },
  },
  {
    name: "not pregnant, no foster care, no caregiver, no accommodation: stale follow-ups",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 0)
      p.pregnant = "no"
      p.everInFosterCare = "no"
      p.fosterCareState = SENTINEL
      p.caregiverOfChildUnder19 = "no"
      p.caregiverChildren = [{ name: SENTINEL, dateOfBirth: "2015-01-01" }]
      p.needsAccommodation = "no"
      p.accommodationOther = SENTINEL
      p.accommodationConditionOther = SENTINEL
    },
  },
  // Task 6: Person 2's pages
  {
    name: "Person 2 not applying: stale card name and immigration text",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 1)
      p.applyingForCoverage = "no"
      p.ssnCardName = SENTINEL
      p.immigrationOtherName = SENTINEL
      p.immigrationCountry = SENTINEL
    },
  },
  {
    name: "Person 2 lives with Person 1: stale home address",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 1)
      p.livesWithPerson1 = "yes"
      p.streetAddress = SENTINEL
      p.city = SENTINEL
      p.apartment = SENTINEL
    },
  },
  {
    name: "Person 2 has no income: stale rows",
    base: completeRichHousehold,
    flip: (a) => {
      const p = person(a, 1)
      p.hasIncome = "no"
      p.income = [{ kind: "wages", amount: STALE_NUMBER, frequency: "monthly", employerNameAndAddress: SENTINEL }] as never
    },
  },
  // Task 7-8: assets and previous bills (all gates closed with leftover rows)
  {
    name: "every asset gate No: stale rows in every table",
    base: completeFacilityCouple,
    flip: (a) => {
      for (const gate of Object.keys(a.assets.gates) as Array<keyof Saca2Answers["assets"]["gates"]>) a.assets.gates[gate] = "no"
      a.assets.bankAccounts[0].institution = SENTINEL
      a.assets.primaryResidence[0].address = SENTINEL
      a.assets.otherRealEstate[0].address = SENTINEL
      a.assets.lifeInsurance[0].company = SENTINEL
      a.assets.securities[0].company = SENTINEL
      a.assets.annuities[0].institution = SENTINEL
      a.assets.assistedLivingDeposits[0].facilityName = SENTINEL
      a.assets.vehicles[0].yearMakeModel = SENTINEL
      a.assets.burial[0].amount = STALE_NUMBER
      a.assets.trusts[0].name = SENTINEL
      a.assets.trusts[0].trustees = SENTINEL
    },
  },
  {
    name: "previous bills No: stale requests",
    base: completeRichHousehold,
    flip: (a) => {
      a.previousMedicalBills.hasBills = "no"
      a.previousMedicalBills.requests = [{ name: SENTINEL, earliestDateRequested: "2026-01-01", circumstancesChanged: "yes" }]
    },
  },
  {
    name: "previous bills Yes but no coverage wanted: stale request",
    base: completeRichHousehold,
    flip: (a) => {
      a.previousMedicalBills.hasBills = "yes"
      a.previousMedicalBills.wantsCoverageForPeriod = "no"
      a.previousMedicalBills.requests = [{ name: SENTINEL, earliestDateRequested: "2026-01-01", circumstancesChanged: "yes" }]
    },
  },
  // Task 9: health coverage
  {
    name: "no other coverage: stale Medicare, employer coverage and other-coverage details",
    base: completeFacilityCouple,
    flip: (a) => {
      a.health.hasOtherCoverage = "no"
      a.health.medicare[0].personName = SENTINEL
      a.health.partBHelpNames = SENTINEL
      a.health.otherCoverageDetails = { coveredNames: SENTINEL, policyNumber: SENTINEL, startEndDates: SENTINEL }
      a.health.employerCoverage = [{ employerName: SENTINEL, planName: SENTINEL, coveredNames: SENTINEL, policyNumber: SENTINEL, startEndDates: SENTINEL }]
    },
  },
  {
    name: "Part B help No: stale names",
    base: completeFacilityCouple,
    flip: (a) => {
      a.health.wantsPartBHelp = "no"
      a.health.partBHelpNames = SENTINEL
    },
  },
  {
    name: "no HRA offered: stale HRA entry",
    base: completeRichHousehold,
    flip: (a) => {
      a.health.hra.anyoneOffered = "no"
      a.health.hra.entries = [{ individualName: SENTINEL, dateOfBirth: null, employerName: SENTINEL, federalTaxId: SENTINEL, hraType: "qsehra", startDate: null, endDate: null, maxSelfOnlyAmount: STALE_NUMBER, qsehraFamilyIntent: null, qsehraFamilyMax: null, ichraAcceptIntent: null }]
    },
  },
  {
    name: "Step 9 hidden (no mixed-age couple): stale names",
    base: completeFacilityCouple,
    flip: (a) => {
      a.health.additionalCoverage = { breastOrCervicalCancer: "yes", breastOrCervicalName: SENTINEL, hivPositive: "yes", hivName: SENTINEL }
    },
  },
  // Task 10: signing
  {
    name: "applicant signs: stale responsible party",
    base: completeRichHousehold,
    flip: (a) => {
      a.signature.signedBy = "applicant"
      a.signing.emancipatedMinor = "no"
      Object.assign(a.signing.responsibleParty, { firstName: SENTINEL, lastName: SENTINEL, street: SENTINEL, city: SENTINEL, email: SENTINEL, relationship: SENTINEL })
    },
  },
  // Task 11: Supplement A
  {
    name: "Supplement A hidden: stale facility, expenses, transfers and family",
    base: completeFacilityCouple,
    flip: (a) => {
      a.intake.programs.longTermCare = false
      a.intake.programs.hcbsWaiver = false
      a.intake.programs.masshealthHsn = true
      const s = a.supplements.a
      s.needsNursingFacility = "no"
      s.applyingHcbsWaiver = "no"
      s.applyingPace = "no"
      s.facility.name = SENTINEL
      s.home.otherRealEstateDescription = SENTINEL
      s.familyAtHome.members = [{ name: SENTINEL, ssn: "", relationship: SENTINEL, dateOfBirth: null, monthlyIncome: STALE_NUMBER }]
      a.transfers[0].description = SENTINEL
    },
  },
  {
    name: "Supplement A shown, closed gates: stale facility, home, relatives, family, transfers, deposit",
    base: completeHomeWithAllSupplements,
    flip: (a) => {
      const s = a.supplements.a
      s.needsNursingFacility = "no"
      s.facility = { ...s.facility, name: SENTINEL, address: SENTINEL, placedFromState: SENTINEL }
      s.home.ownsHome = "no"
      s.home.properties = [{ ownerNames: SENTINEL, propertyAddress: SENTINEL, ownershipType: "individual", fairMarketValue: STALE_NUMBER }]
      s.home.spouse = { has: "no", name: SENTINEL, livesInHome: "yes" }
      s.home.sibling = { has: "no", name: SENTINEL, livesInHome: "yes" }
      s.home.ownsOtherRealEstate = "no"
      s.home.otherRealEstateDescription = SENTINEL
      s.familyAtHome = { hasFamily: "no", members: [{ name: SENTINEL, ssn: "", relationship: SENTINEL, dateOfBirth: null, monthlyIncome: null }] }
      s.facilityDeposit = { ...s.facilityDeposit, gaveDeposit: "no", facilityName: SENTINEL, facilityAddress: SENTINEL, returnedToName: SENTINEL }
      s.longTermCareInsurance = { hasPolicy: "no", policies: [{ companyAndPolicyNumber: SENTINEL, policyholder: SENTINEL, effectiveDate: null, premium: null }] }
      s.transferAnswers = { trust: "no", income: "no", assets: "no", deed: "no", lifeEstateLivedOneYear: null, addedToDeed: "no", loanOrNote: "no", annuity: "no" }
      a.transfers = [{ description: SENTINEL, dateOfTransfer: null, transferredTo: SENTINEL, relationship: SENTINEL, amount: STALE_NUMBER }]
    },
  },
  // Task 12a: Supplements B, C and D
  {
    name: "no AI/AN member: stale Supplement B",
    base: completeHomeWithAllSupplements,
    flip: (a) => {
      a.aian.anyMember = "no"
      a.supplements.b.members = [member(1, { name: SENTINEL, tribeName: SENTINEL }), member(2, { name: SENTINEL })] as never
    },
  },
  {
    name: "no PCA need: stale Supplement C",
    base: completeHomeWithAllSupplements,
    flip: (a) => {
      a.pca.needsPca = "no"
      a.supplements.c[0].healthProblems = [SENTINEL, SENTINEL, SENTINEL]
      a.supplements.c[0].caregivers = [{ name: SENTINEL, relationship: SENTINEL }]
    },
  },
  {
    name: "no employer coverage offered: stale Supplement D",
    base: completeHomeWithAllSupplements,
    flip: (a) => {
      a.health.employerOfferedCoverage = "no"
      a.supplements.d.jobs = [job(1, { employeeName: SENTINEL, employerName: SENTINEL, contactName: SENTINEL, individualPlanName: SENTINEL })] as never
    },
  },
  // Task 12b: ARD-1122 and IRS 4506
  {
    name: "applicant signs: stale ARD-1122 data",
    base: completeFacilityCouple,
    flip: (a) => {
      a.signature.signedBy = "applicant"
      Object.assign(a.attachments.ard, { repName: SENTINEL, repEmail: SENTINEL, orgName: SENTINEL, staffName: SENTINEL, officerName: SENTINEL, legalDocument: SENTINEL })
    },
  },
  {
    name: "ARD section II: stale staff and legal-document text (Section II itself names the organization)",
    base: completeFacilityCouple,
    flip: (a) => {
      Object.assign(a.attachments.ard, { section: "cannotDesignate", repKind: "person", staffName: SENTINEL, staffEmail: SENTINEL, orgName: "", legalDocument: SENTINEL })
    },
  },
  {
    name: "ARD section III: stale officer and organization text",
    base: completeFacilityCouple,
    flip: (a) => {
      Object.assign(a.attachments.ard, { section: "appointedByLaw", repKind: "person", officerName: SENTINEL, officerTitle: SENTINEL, staffName: SENTINEL, orgName: SENTINEL })
    },
  },
  {
    name: "no tax returns filed: stale IRS 4506 data",
    base: completeHomeWithAllSupplements,
    flip: (a) => {
      a.supplements.a.taxReturnsFiled = "neither"
      a.attachments.irs4506.previousAddress = SENTINEL
      a.attachments.irs4506.taxpayerId = SENTINEL
      a.attachments.irs4506.formNumber = SENTINEL
    },
  },
  {
    name: "copies of the tax returns held: stale IRS 4506 data",
    base: completeHomeWithAllSupplements,
    flip: (a) => {
      a.supplements.a.taxReturnsFiled = "bothYears"
      a.supplements.a.hasCopiesOfTaxReturns = "yes"
      a.attachments.irs4506.previousAddress = SENTINEL
      a.attachments.irs4506.formNumber = SENTINEL
    },
  },
  {
    name: "IRS 4506 shown, Person 1 has an SSN and no joint return: stale ITIN and spouse",
    base: completeHomeWithAllSupplements,
    flip: (a) => {
      a.supplements.a.taxReturnsFiled = "bothYears"
      a.supplements.a.hasCopiesOfTaxReturns = "no"
      a.persons[0].hasSsn = "yes"
      a.persons[0].ssn = "123-45-6789"
      a.attachments.irs4506.jointReturn = "no"
      a.attachments.irs4506.taxpayerId = SENTINEL
    },
  },
]

describe("stale answers behind closed gates never reach the PDF (every gate-flip scenario of the region tests)", () => {
  it("the detector bites: a sentinel in a visible answer is found in the field values and in the printed text", async () => {
    const a = completeRichHousehold()
    person(a, 0).streetAddress = SENTINEL
    const bytes = await fillSaca2Pdf(a, null, ON)
    expect(everything(await readFilled(bytes))).toContain(SENTINEL)
    const text = pdfText(bytes)
    if (text !== null) expect(text).toContain(SENTINEL)
  })

  it.each(SCENARIOS)("$name", async ({ base, flip }) => {
    const answers = base()
    flip(answers)
    // the scenario really plants something: the sentinel is in the answers
    const planted = JSON.stringify(answers)
    expect(planted.includes(SENTINEL) || planted.includes(String(STALE_NUMBER))).toBe(true)
    const bytes = await fillSaca2Pdf(answers, null, ON)
    const values = await readFilled(bytes)
    expect(everything(values)).not.toContain(SENTINEL)
    expect(everything(values)).not.toContain(String(STALE_NUMBER))
    const text = pdfText(bytes)
    if (text !== null) {
      expect(text).not.toContain(SENTINEL)
      expect(text).not.toContain(String(STALE_NUMBER))
    }
  })
})
