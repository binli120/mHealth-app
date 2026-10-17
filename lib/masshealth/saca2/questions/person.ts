/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "../age"
import { validateStateCode, validateZip } from "./validators"
import {
  checkbox,
  date,
  email,
  money,
  number,
  opts,
  phone,
  repeater,
  select,
  ssn,
  text,
  yesNo,
} from "./builders"
import { IMMIGRATION_DOCUMENT_OPTIONS, IMMIGRATION_STATUS_OPTIONS } from "./immigration-options"
import { INCOME_FREQUENCIES } from "./options"
import { DEMOGRAPHICS_SECTION, validateDemographics } from "./person-demographics"
import { applying, isSecondPerson, person, who } from "./person-context"
import type { Saca2QuestionContext, Saca2StepContent } from "./types"

const hasHomeAddress = (ctx: Saca2QuestionContext) => !person(ctx)?.noHomeAddress
const needsMailingAddress = (ctx: Saca2QuestionContext) => {
  const p = person(ctx)
  return Boolean(p?.noHomeAddress) || !p?.mailingSameAsStreet
}

const INCOME_KINDS = opts([
  ["wages", "Wages or salary"],
  ["selfEmployment", "Self-employment"],
  ["socialSecurity", "Social Security benefits"],
  ["pension", "Retirement or pension"],
  ["annuity", "Annuities"],
  ["trust", "Trusts"],
  ["unemployment", "Unemployment"],
  ["investment", "Interest, dividends, and other investment income"],
  ["royalty", "Royalty income"],
  ["alimony", "Alimony received"],
  ["veterans", "Federal veteran's benefits"],
  ["militaryRetirement", "Military retirement pay"],
  ["otherTaxable", "Other taxable income"],
  ["rental", "Rental income"],
  ["lottery", "Lottery and gambling winnings"],
])

function validateDateOfBirth(value: unknown, ctx: Saca2QuestionContext): string | null {
  if (typeof value !== "string") return null
  if (value < "1900-01-01") return "Enter a date of birth in 1900 or later."
  if (calculateAge(value, ctx.on) === null) return "Date of birth cannot be in the future."
  return null
}

export const PERSON_STEP_CONTENT: Saca2StepContent = {
  scope: "person",
  validateStep: (answers, personIndex) => ({
    ...validateDemographics(answers, personIndex),
  }),
  sections: [
    {
      id: "who",
      title: who("About you", "About this person"),
      questions: [
        text("firstName", "First name", { required: true }),
        text("middleName", "Middle name"),
        text("lastName", "Last name", { required: true }),
        text("suffix", "Suffix (Jr., Sr., III)"),
        date("dateOfBirth", "Date of birth", { required: true, validate: validateDateOfBirth }),
        select("sexAtBirth", who("What was your sex assigned at birth?", "What was this person's sex assigned at birth?"), opts([["male", "Male"], ["female", "Female"]]), {
          required: true,
          help: "This is usually the sex that was originally listed on the birth certificate.",
        }),
        text("relationshipToPerson1", "How is this person related to Person 1?", {
          required: true,
          visibleWhen: isSecondPerson,
        }),
        yesNo("applyingForCoverage", who("Are you applying for health coverage for yourself?", "Is this person applying for health coverage?"), {
          required: true,
          help: "If No, you only need to answer the address, contact, and income questions.",
        }),
      ],
    },
    {
      id: "home",
      title: "Where you live",
      questions: [
        checkbox("noHomeAddress", "No home address (a mailing address is required)"),
        text("streetAddress", "Street address", { required: true, visibleWhen: hasHomeAddress }),
        text("apartment", "Apartment or unit number", { visibleWhen: hasHomeAddress }),
        text("city", "City", { required: true, visibleWhen: hasHomeAddress }),
        text("state", "State", {
          required: true,
          visibleWhen: hasHomeAddress,
          validate: validateStateCode,
        }),
        text("zip", "ZIP code", {
          required: true,
          visibleWhen: hasHomeAddress,
          validate: validateZip,
        }),
        text("county", "County", { visibleWhen: hasHomeAddress }),
        yesNo("inInstitution", who("Is where you live a hospital, nursing facility, or other institution?", "Is where this person lives a hospital, nursing facility, or other institution?"), {
          required: true,
        }),
        text("facilityName", "Facility name", {
          required: true,
          visibleWhen: (ctx) => person(ctx)?.inInstitution === "yes",
        }),
        checkbox("mailingSameAsStreet", "Mailing address is the same as the street address", { visibleWhen: hasHomeAddress }),
        text("mailingAddress", "Mailing street address", { required: true, visibleWhen: needsMailingAddress }),
        text("mailingApartment", "Mailing apartment or unit number", { visibleWhen: needsMailingAddress }),
        text("mailingCity", "Mailing city", { required: true, visibleWhen: needsMailingAddress }),
        text("mailingState", "Mailing state", {
          required: true,
          visibleWhen: needsMailingAddress,
          validate: validateStateCode,
        }),
        text("mailingZip", "Mailing ZIP code", {
          required: true,
          visibleWhen: needsMailingAddress,
          validate: validateZip,
        }),
      ],
    },
    {
      id: "contact",
      title: "Contact",
      questions: [
        phone("mobilePhone", "Mobile phone number", { required: (ctx) => ctx.personIndex === 0 }),
        phone("otherPhone", "Other phone number"),
        email("email", "Email address"),
        text("preferredLanguageSpoken", "Preferred spoken language, if not English"),
        text("preferredLanguageWritten", "Preferred written language, if not English", {
          help: "We use your preferred written language to send notices. If you leave this blank, notices are sent in English.",
        }),
      ],
    },
    DEMOGRAPHICS_SECTION,
    {
      id: "status",
      title: "Identity, citizenship, and residency",
      questions: [
        yesNo("hasSsn", who("Do you have a Social Security number (SSN)?", "Does this person have a Social Security number (SSN)?"), {
          required: applying,
          visibleWhen: applying,
          help: "An SSN is needed for everyone applying who has one. Exceptions: religious exemption, nonwork-only SSN, or not eligible for an SSN.",
        }),
        ssn("ssn", "Social Security number", {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasSsn === "yes",
        }),
        select(
          "noSsnReason",
          "Why is there no SSN?",
          opts([
            ["illness", "Illness exception"],
            ["justApplied", "Just applied"],
            ["noncitizenException", "Noncitizen exception"],
            ["religiousException", "Religious exception"],
          ]),
          { visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasSsn === "no" },
        ),
        yesNo("usCitizenOrNational", who("Are you a US citizen or US national?", "Is this person a US citizen or US national?"), {
          required: applying,
          visibleWhen: applying,
        }),
        yesNo("naturalizedCitizen", "Naturalized, derived, or acquired citizen (not born in the US)?", {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.usCitizenOrNational === "yes",
        }),
        text("alienNumber", "Alien number", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.naturalizedCitizen === "yes",
        }),
        text("citizenshipCertificateNumber", "Naturalization or citizenship certificate number", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.naturalizedCitizen === "yes",
        }),
        yesNo("hasEligibleImmigrationStatus", "Do they have an eligible immigration status?", {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.usCitizenOrNational === "no",
        }),
        select("immigrationStatus", "Immigration status", IMMIGRATION_STATUS_OPTIONS, {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        select("immigrationDocumentType", "Immigration document type", IMMIGRATION_DOCUMENT_OPTIONS, {
          required: true,
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        text("immigrationDocumentId", "Document ID number", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        date("immigrationDocumentExpiry", "Document expiration date", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes",
        }),
        yesNo("residentOfMassachusetts", who("Do you live in Massachusetts and intend to stay here (even without a fixed address), or did you come for a job or to look for work?", "Does this person live in Massachusetts and intend to stay here (even without a fixed address), or did they come for a job or to look for work?"), {
          required: applying,
          visibleWhen: applying,
          help: "If you are only visiting for pleasure or to receive medical care outside a nursing facility, answer No.",
        }),
        yesNo("caregiverOfChildUnder19", who("Do you live with a child younger than 19 and are you the main person taking care of them?", "Does this person live with a child younger than 19 and are they the main person taking care of them?"), {
          required: applying,
          visibleWhen: applying,
          help: "If Yes, the ACA-3 application may fit better than SACA-2.",
        }),
        yesNo("isLegallyMarried", who("Are you legally married?", "Is this person legally married?"), {
          required: applying,
          visibleWhen: applying,
        }),
        yesNo("livesWithPerson1", "Does this person live with Person 1?", {
          required: isSecondPerson,
          visibleWhen: isSecondPerson,
        }),
        yesNo("hasDisability", who("Do you have a disability (including a disabling mental health condition) that has lasted or is expected to last at least 12 months?", "Does this person have a disability (including a disabling mental health condition) that has lasted or is expected to last at least 12 months?"), {
          required: applying,
          visibleWhen: applying,
          help: "If legally blind, answer Yes.",
        }),
        yesNo("everGotSsi", who("Did you ever get Supplemental Security Income (SSI)?", "Did this person ever get Supplemental Security Income (SSI)?"), {
          required: applying,
          visibleWhen: applying,
        }),
        text("lastSsiMonth", "When did they last get SSI? (mm/yyyy)", {
          visibleWhen: (ctx) => applying(ctx) && person(ctx)?.everGotSsi === "yes",
          validate: (v) => (/^(0[1-9]|1[0-2])\/\d{4}$/.test(String(v)) ? null : "Use the format mm/yyyy."),
        }),
        select(
          "livingArrangement",
          "Where do they live?",
          opts([
            ["alone", "Alone"],
            ["withSpouse", "With a spouse"],
            ["restHome", "In a rest home"],
            ["someoneElsesHome", "In someone else's home"],
          ]),
          { visibleWhen: (ctx) => applying(ctx) && person(ctx)?.everGotSsi === "yes" },
        ),
        yesNo("hasMedicareOrSsiOrSsdi", who("Do you get Medicare, SSI, or SSDI?", "Does this person get Medicare, SSI, or SSDI?"), {
          required: applying,
          visibleWhen: applying,
          help: "Not a form question. We use it to tell you which proofs you will need (people who get these usually do not need to prove citizenship and identity again).",
        }),
      ],
    },
    {
      id: "income",
      title: "Income",
      questions: [
        yesNo("hasIncome", who("Do you have any income?", "Does this person have any income?"), { required: true }),
        repeater(
          "income",
          "Income sources",
          {
            questions: [
              select("kind", "Type of income", INCOME_KINDS, { required: true }),
              money("amount", "Amount before taxes ($)", { required: true }),
              select("frequency", "How often", INCOME_FREQUENCIES, { required: true }),
              text("employerNameAndAddress", "Employer name and address", {
                visibleWhen: (ctx) => ctx.item?.kind === "wages",
              }),
              number("hoursPerWeek", "Average hours worked each week", {
                visibleWhen: (ctx) => ctx.item?.kind === "wages" || ctx.item?.kind === "selfEmployment",
              }),
            ],
            emptyItem: () => ({ kind: null, amount: null, frequency: null }),
            addLabel: "Add an income source",
            itemTitle: "Income source",
            maxItems: 15,
          },
          { required: true, visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes" },
        ),
        money("expectedIncomeThisYear", "Total expected income this calendar year ($)", {
          required: true,
          visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes",
        }),
        money("expectedIncomeNextYear", "Total expected income next calendar year, if different ($)", {
          visibleWhen: (ctx) => person(ctx)?.hasIncome === "yes",
        }),
      ],
    },
  ],
}
