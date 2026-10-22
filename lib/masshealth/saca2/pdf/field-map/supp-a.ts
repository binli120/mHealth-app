/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { fitLines } from "../derived-assets"
import {
  OWNERSHIP_TYPES,
  SUPP_A_FAMILY_LINES,
  SUPP_A_POLICY_LINES,
  SUPP_A_PROPERTY_LINES,
  SUPP_A_TRANSFER_LINES,
  WRAPPED_TEXTS,
} from "../derived-supp-a"
import type { Encoder, FieldEntry } from "../types"

/** Every Yes/No group on the Supplement A pages names its states: Yes (left) = "Yes", No = "No". */
const YES_NO: Encoder = { kind: "yesNo", yes: "Yes", no: "No" }

const STEP = "suppA" as const

const answer = (field: string, path: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "answer", stepId: STEP, path },
  encode,
})

const rowOf =
  (path: string, index: number) =>
  (field: string, key: string, encode: Encoder): FieldEntry => ({
    fields: [field],
    source: { kind: "row", stepId: STEP, path, index, key },
    encode,
  })

const derived = (field: string, id: string, encode: Encoder = "text"): FieldEntry => ({
  fields: [field],
  source: { kind: "derived", id },
  encode,
})

const a = (path: string) => `supplements.a.${path}`

// ---------------------------------------------------------------------------------------------
// Form page 25 (PDF index 26): programs, applicant and facility, spouse expenses, family at home
// ---------------------------------------------------------------------------------------------

const FAMILY_BLOCKS = [
  {
    name: "Name_SuppA_5",
    ssn: "Social security number__SuppA_3",
    relationship: "Relationship_SuppA",
    dob: "Date of birth mmddyyyy_SuppA",
    income: "Monthly income before deductions $_SuppA",
  },
  {
    name: "Name__SuppA_6",
    ssn: "Social security number__SuppA_4",
    relationship: "Relationship__SuppA_2",
    dob: "Date of birth mmddyyyy__SuppA_2",
    income: "Monthly income before deductions $_SuppA_2",
  },
]

const PAGE_25: FieldEntry[] = [
  answer("Do you need long-term-care services in a nursing home type facility?_SuppA", a("needsNursingFacility"), YES_NO),
  answer("Are you applying for or getting long-term-care services at home under a Home- and Community-Based Services Waiver?_SuppA", a("applyingHcbsWaiver"), YES_NO),
  answer("Are you applying for or getting long-term-care services and supports through Program of All-Inclusive Care for the Elderly (PACE)?_SuppA", a("applyingPace"), YES_NO),

  // Person 1's identity repeats here; the resolvers write nothing when Supplement A is hidden
  derived("Last name first name middle initial_SuppA", "p1.nameLastFirst"),
  derived("Social security number_SuppA", "p1.ssnLine"),

  derived("Name and address of hospital nursing facility or other institution_SuppA", "suppA.facility.nameAndAddress"),
  answer("Were you placed here by another state?_SuppA", a("facility.placedByOtherState"), YES_NO),
  answer("If Yes what state_SuppA", a("facility.placedFromState"), "text"),
  answer("Date of admission mmddyyyy_SuppA", a("facility.admissionDate"), "date"),
  answer("Do you have to pay guardianship expenses for a court-appointed guardian?", a("facility.paysGuardianshipExpenses"), YES_NO),

  derived("Spouses last name first name middle initial_SuppA", "suppA.spouse.nameLastFirst"),
  derived("Social security number__SuppA_2", "suppA.spouse.ssnLine"),
  answer("Rent_SuppA", a("spouseMonthlyExpenses.rent"), "money"),
  answer("Mortgage_SuppA", a("spouseMonthlyExpenses.mortgage"), "money"),
  answer("Insurance_SuppA", a("spouseMonthlyExpenses.homeownersInsurance"), "money"),
  answer("Tax_SuppA", a("spouseMonthlyExpenses.realEstateTaxes"), "money"),
  answer("Maintance charge_SuppA", a("spouseMonthlyExpenses.condoOrCoopFee"), "money"),
  answer("Room and board for assisted liveing_SuppA", a("spouseMonthlyExpenses.assistedLivingRoomAndBoard"), "money"),
  answer("Does your spouse pay for heat?", a("spouseMonthlyExpenses.paysHeat"), YES_NO),
  answer("Does your spouse pay for utilities?", a("spouseMonthlyExpenses.paysUtilities"), YES_NO),
  answer("Is a child, parent, brother, and/or sister living with your spouse?", a("familyAtHome.hasFamily"), YES_NO),
  ...fitLines(FAMILY_BLOCKS, SUPP_A_FAMILY_LINES, "FAMILY_BLOCKS").flatMap((block, index) => {
    const member = rowOf(a("familyAtHome.members"), index)
    return [
      member(block.name, "name", "text"),
      derived(block.ssn, `suppA.family.${index}.ssnLine`),
      member(block.relationship, "relationship", "text"),
      member(block.dob, "dateOfBirth", "date"),
      member(block.income, "monthlyIncome", "money"),
    ]
  }),
]

// ---------------------------------------------------------------------------------------------
// Form page 26 (PDF index 27): resource transfers and the facility deposit
// ---------------------------------------------------------------------------------------------

const TRANSFER_QUESTIONS: Array<[string, string]> = [
  ["In the past 60 months_6a", "trust"],
  ["In the past 60 months_6b", "income"],
  ["In the past 60 months_6c", "assets"],
  ["In the past 60 months_6d", "deed"],
  ["In the past 60 months_6e", "lifeEstateLivedOneYear"],
  ["In the past 60 months_6f", "addedToDeed"],
  ["In the past 60 months_6g", "loanOrNote"],
  ["In the past 60 months_6h", "annuity"],
]

/** The transfers table: three rows of description + date, then to whom + relationship + amount. */
const TRANSFER_ROWS = [
  {
    description: "Description of assetincome_SuppA",
    date: "Date of transfer mmddyyyy_SuppA",
    to: "Transferred to whom_SuppA",
    relationship: "Relationship to you or your spouse_SuppA",
    amount: "Amount  of transfer_SuppA",
  },
  {
    description: "Description of assetincome_SuppA_2",
    date: "Date of transfer mmddyyyy_SuppA_2",
    to: "Transferred to whom_SuppA_2",
    relationship: "Relationship to you or your spouse_SuppA_2",
    amount: "Amount  of transfer_SuppA_2",
  },
  {
    description: "Description of assetincome_SuppA_3",
    date: "Date of transfer mmddyyyy_SuppA_3",
    to: "Transferred to whom_SuppA_3",
    relationship: "Relationship to you or your spouse_SuppA_3",
    amount: "Amount  of transfer_SuppA_3",
  },
]

const PAGE_26: FieldEntry[] = [
  ...TRANSFER_QUESTIONS.map(([field, key]) => answer(field, a(`transferAnswers.${key}`), YES_NO)),
  ...fitLines(TRANSFER_ROWS, SUPP_A_TRANSFER_LINES, "TRANSFER_ROWS").flatMap((fields, index) => {
    const transfer = rowOf("transfers", index)
    return [
      transfer(fields.description, "description", "text"),
      transfer(fields.date, "dateOfTransfer", "date"),
      transfer(fields.to, "transferredTo", "text"),
      transfer(fields.relationship, "relationship", "text"),
      transfer(fields.amount, "amount", "money"),
    ]
  }),
  answer("Have you, your spouse, or someone acting on your behalf given a deposit?", a("facilityDeposit.gaveDeposit"), YES_NO),
  answer("Name of facility_SuppA", a("facilityDeposit.facilityName"), "text"),
  answer("Address of facility_SuppA", a("facilityDeposit.facilityAddress"), "text"),
  answer("Amount_SuppA_5", a("facilityDeposit.amount"), "money"),
  answer("Does the facility still have the deposit?", a("facilityDeposit.stillHeld"), YES_NO),
  answer("Did the facility return the deposit?", a("facilityDeposit.returned"), YES_NO),
  answer("Name of person_SuppA", a("facilityDeposit.returnedToName"), "text"),
  answer("Address_SuppA_5", a("facilityDeposit.returnedToAddress"), "text"),
]

// ---------------------------------------------------------------------------------------------
// Form pages 27-28 (PDF indexes 28-29): real estate, long-term-care insurance, tax returns
// ---------------------------------------------------------------------------------------------

/**
 * The form's two "your home" blocks. The ownership group's widget order differs: block 1 is
 * 1 Individual, 2 Tenancy in common, 3 Joint tenancy, 4 Life estate (read from the widget positions);
 * block 2 is 1 Individual, 2 Joint tenancy, 3 Tenancy in common, 4 Life estate.
 */
const PROPERTY_BLOCKS = [
  {
    ownership: "Type of ownership (Check one.)",
    states: { individual: "1", tenancyInCommon: "2", jointTenancy: "3", lifeEstate: "4" },
    value: {
      individual: "Individual Fair-market value $",
      tenancyInCommon: "Tenancy in common Fair-market value",
      jointTenancy: "Joint tenancy Fair-market value",
      lifeEstate: "Life estate Fair-market value",
    },
  },
  {
    ownership: "Type of ownership (Check one.)_2",
    states: { individual: "1", tenancyInCommon: "3", jointTenancy: "2", lifeEstate: "4" },
    value: {
      individual: "Individual Fair-market value $_2",
      tenancyInCommon: "Tenancy in common Fair-market value_2",
      jointTenancy: "Joint tenancy Fair-market value_2",
      lifeEstate: "Life estate Fair-market value_2",
    },
  },
]

/** Q9-Q14: each relative has a Yes/No gate, a name, "living in your home?", and sometimes one more answer. */
const RELATIVES: Array<{ key: string; has: string; name: string; lives: string; dob?: string }> = [
  { key: "spouse", has: "9. Do you have a spouse?", name: "9. Name_7", lives: "Is this person living in your home?_9" },
  { key: "disabledChild", has: "10. Do you have a permanently and totally disabled or blind child?", name: "10. Name_8", lives: "Is this person living in your home?_10" },
  {
    key: "childUnder21",
    has: "11. Do you have a child under 21 years of age?",
    name: "11. Name_9",
    lives: "Is this person living in your home?_11",
    dob: "11. Date of birth mmddyyyy_3",
  },
  { key: "sibling", has: "12. Do you have a brother or sister with a legal interest in the home?", name: "12. Name_10", lives: "Is this person living in your home?_12" },
  { key: "caregiverChild", has: "13. Has  son or daughter provided care to you that allowed you to live in the home?", name: "13. Name_11", lives: "Is this person living in your home?_13" },
  { key: "dependentRelative", has: "14. Do you have a dependent relative?", name: "14. Name_12", lives: "Is this person living in your home?_14" },
]

/** Long answers go over the form's several printed lines (derived `suppA.wrap.*`, wrapped by measured width); the rest is on a sheet. */
const wrapped = (name: string): FieldEntry[] =>
  WRAPPED_TEXTS[name].fields.map((field, line) => derived(field, `suppA.wrap.${name}.${line}`))

const POLICY_BLOCKS = [
  {
    company: "17. Company name/Policy number_SuppA",
    holder: "17. Policyholder name_suppA",
    effective: "17. Effective date mmddyyyy_SuppA",
    premium: "17. Premium amount_SuppA",
  },
  {
    company: "17. Company name/Policy number_SuppA_2",
    holder: "17.Policyholder name_SuppA_2",
    effective: "17. Effective date mmddyyyy_SuppA_2",
    premium: "17. Premium amount_SuppA_2",
  },
]

const PAGES_27_28: FieldEntry[] = [
  answer("Real estate?", a("home.ownsHome"), YES_NO),
  ...fitLines(PROPERTY_BLOCKS, SUPP_A_PROPERTY_LINES, "PROPERTY_BLOCKS").flatMap((block, index) => [
    ...wrapped(`property${index}.owners`),
    ...wrapped(`property${index}.address`),
    rowOf(a("home.properties"), index)(block.ownership, "ownershipType", { kind: "pick", states: block.states }),
    ...OWNERSHIP_TYPES.map((type) => derived(block.value[type], `suppA.property.${index}.fmv.${type}`, "money")),
  ]),
  ...RELATIVES.flatMap(({ key, has, name, lives, dob }) => [
    answer(has, a(`home.${key}.has`), YES_NO),
    answer(name, a(`home.${key}.name`), "text"),
    ...(dob === undefined ? [] : [answer(dob, a(`home.${key}.dateOfBirth`), "date")]),
    answer(lives, a(`home.${key}.livesInHome`), YES_NO),
  ]),
  ...wrapped("dependentRelative"),
  answer("15. Do you intend to return to your home?", a("intendsToReturnHome"), YES_NO),

  answer("16 Do you or your spouse own or have a legal interest in other real estate not listed in 8 above?", a("home.ownsOtherRealEstate"), YES_NO),
  ...wrapped("otherRealEstate"),

  answer("17. Do you or your spouse have long-term-care insurance?", a("longTermCareInsurance.hasPolicy"), YES_NO),
  ...fitLines(POLICY_BLOCKS, SUPP_A_POLICY_LINES, "POLICY_BLOCKS").flatMap((block, index) => {
    const policy = rowOf(a("longTermCareInsurance.policies"), index)
    return [
      policy(block.company, "companyAndPolicyNumber", "text"),
      policy(block.holder, "policyholder", "text"),
      policy(block.effective, "effectiveDate", "date"),
      policy(block.premium, "premium", "money"),
    ]
  }),

  // Q18: the wizard's three options in the order of the form's three boxes
  answer("18. Did you or your spouse file U.S. income tax returns in the last two years?", a("taxReturnsFiled"), {
    kind: "pick",
    states: { bothYears: "1", oneYear: "2", neither: "3" },
  }),
]

/**
 * Supplement A, form pages 25-28. The wizard's `hasCopiesOfTaxReturns` has no box on the form (the
 * form only says to send copies or IRS Form 4506), so it is not written. The signature block is never-fill.
 */
export const SUPP_A_ENTRIES: FieldEntry[] = [...PAGE_25, ...PAGE_26, ...PAGES_27_28]
