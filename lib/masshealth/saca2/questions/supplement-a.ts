/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FamilyMemberAtHome, HomeProperty, LongTermCarePolicy, Saca2Transfer } from "../types"
import { isStepVisible } from "../visibility"
import { date, money, opts, repeater, select, ssn, text, yesNo } from "./builders"
import type { Saca2Question, Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"

const supplementA = (ctx: Saca2QuestionContext) => ctx.answers.supplements.a
const needsNursingFacility = (ctx: Saca2QuestionContext) => supplementA(ctx).needsNursingFacility === "yes"
const spouseIsPresent = (ctx: Saca2QuestionContext) => isStepVisible("person2", ctx.answers, ctx.on)
const spouseAtHomeApplies = (ctx: Saca2QuestionContext) => needsNursingFacility(ctx) && spouseIsPresent(ctx)

const INTRO_SECTION: Saca2Section = {
  id: "intro",
  title: "Long-term care services and supports",
  description:
    "If you need long-term-care services in a nursing-home-type facility, answer every question and complete every section. If you are applying for a Home- and Community-Based Services (HCBS) Waiver or PACE, you need to complete the resource-transfer and long-term-care-insurance sections.",
  questions: [
    yesNo("supplements.a.needsNursingFacility", "Do you need long-term-care services and supports in a nursing-home-type facility?", { required: true }),
    yesNo("supplements.a.applyingHcbsWaiver", "Are you applying for or getting long-term-care services and supports at home under a Home- and Community-Based Services (HCBS) Waiver?", { required: true }),
    yesNo("supplements.a.applyingPace", "Are you applying for or getting long-term-care services and supports through the Program of All-Inclusive Care for the Elderly (PACE)?", { required: true }),
  ],
}

const FACILITY_SECTION: Saca2Section = {
  id: "facility",
  title: "Applicant and facility information",
  questions: [
    text("supplements.a.facility.name", "Name of the hospital, nursing facility, or other institution", { required: true, visibleWhen: needsNursingFacility }),
    text("supplements.a.facility.address", "Address of the hospital, nursing facility, or other institution", { required: true, visibleWhen: needsNursingFacility }),
    date("supplements.a.facility.admissionDate", "Date of admission", { required: true, visibleWhen: needsNursingFacility }),
    yesNo("supplements.a.facility.placedByOtherState", "Were you placed here by another state?", { required: true, visibleWhen: needsNursingFacility }),
    text("supplements.a.facility.placedFromState", "If Yes, what state?", {
      required: true,
      visibleWhen: (ctx) => needsNursingFacility(ctx) && supplementA(ctx).facility.placedByOtherState === "yes",
    }),
    yesNo("supplements.a.facility.paysGuardianshipExpenses", "Do you have to pay guardianship expenses for a court-appointed guardian?", {
      required: true,
      visibleWhen: needsNursingFacility,
    }),
  ],
}

const EXPENSES_SECTION: Saca2Section = {
  id: "expenses",
  title: "Living expenses of the spouse and family members living at home",
  description:
    "Your spouse living at home may be able to keep some of your income. Tell us about your spouse's current living expenses and send proof. If you do not have a spouse, skip this section.",
  questions: [
    money("supplements.a.spouseMonthlyExpenses.rent", "Rent (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.mortgage", "Mortgage, principal and interest (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.homeownersInsurance", "Homeowner's or tenant's insurance (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.realEstateTaxes", "Real estate taxes (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.condoOrCoopFee", "Required maintenance charge for a condo or co-op (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    money("supplements.a.spouseMonthlyExpenses.assistedLivingRoomAndBoard", "Room and board for assisted living (per month, $)", { visibleWhen: spouseAtHomeApplies }),
    yesNo("supplements.a.spouseMonthlyExpenses.paysHeat", "Does your spouse pay for heat?", { required: true, visibleWhen: spouseAtHomeApplies }),
    yesNo("supplements.a.spouseMonthlyExpenses.paysUtilities", "Does your spouse pay for utilities?", { required: true, visibleWhen: spouseAtHomeApplies }),
    yesNo("supplements.a.familyAtHome.hasFamily", "Is a child, parent, and/or sibling living with your spouse?", {
      required: true,
      visibleWhen: spouseAtHomeApplies,
      help: "If Yes, send proof of each person's monthly income before deductions. These persons must be related to you or your spouse, and one of you must claim them as dependents on your federal income tax return.",
    }),
    repeater(
      "supplements.a.familyAtHome.members",
      "People living with your spouse",
      {
        questions: [
          text("name", "Name", { required: true }),
          ssn("ssn", "Social Security number"),
          text("relationship", "Relationship to you or your spouse", { required: true }),
          date("dateOfBirth", "Date of birth", { required: true }),
          money("monthlyIncome", "Monthly income before deductions ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ name: "", ssn: "", relationship: "", dateOfBirth: null, monthlyIncome: null }) satisfies FamilyMemberAtHome,
        addLabel: "Add a person",
        itemTitle: "Person",
        maxItems: 4,
      },
      {
        required: true,
        visibleWhen: (ctx) => spouseAtHomeApplies(ctx) && supplementA(ctx).familyAtHome.hasFamily === "yes",
      },
    ),
  ],
}

const TRANSFER_KEYS = ["trust", "income", "assets", "deed", "addedToDeed", "loanOrNote", "annuity"] as const
/** 6e (life estate lived in) is deliberately not a transfer: a Yes there is the good answer. */
const anyTransfer = (ctx: Saca2QuestionContext) =>
  TRANSFER_KEYS.some((key) => supplementA(ctx).transferAnswers[key] === "yes")

const TRANSFERS_SECTION: Saca2Section = {
  id: "transfers",
  title: "Resource transfers",
  description: "Resources include both income and assets. These questions cover the past 60 months.",
  questions: [
    yesNo("supplements.a.transferAnswers.trust", "In the past 60 months, has any property that was available or belonged to you or your spouse been transferred into or out of a trust?", { required: true }),
    yesNo("supplements.a.transferAnswers.income", "Did you, your spouse, or someone on your behalf transfer income or the right to income?", { required: true }),
    yesNo("supplements.a.transferAnswers.assets", "Did you, your spouse, or someone on your behalf transfer, change ownership in, give away, or sell any assets, including your home or other real estate?", { required: true }),
    yesNo("supplements.a.transferAnswers.deed", "Did you, your spouse, or someone on your behalf change the deed or the ownership of any real estate, including creating a life estate, even if the life estate was purchased in another person's residence?", { required: true }),
    yesNo("supplements.a.transferAnswers.lifeEstateLivedOneYear", "If you purchased a life estate in another person's home, did you live in the home for at least one year after you purchased the life estate?", {
      help: "Leave blank if this does not apply. A Yes here does not count as a transfer.",
    }),
    yesNo("supplements.a.transferAnswers.addedToDeed", "Did you, your spouse, or someone on your behalf add another name to the deed of any property you own?", { required: true }),
    yesNo("supplements.a.transferAnswers.loanOrNote", "Did you, your spouse, or someone on your behalf receive or give anyone a mortgage, loan, or promissory note on any property or other asset?", { required: true }),
    yesNo("supplements.a.transferAnswers.annuity", "Did you, your spouse, or someone on your behalf purchase or in any way change an annuity?", { required: true }),
    repeater(
      "transfers",
      "Transfers",
      {
        questions: [
          text("description", "Description of asset or income", { required: true }),
          date("dateOfTransfer", "Date of transfer", { required: true }),
          text("transferredTo", "Transferred to whom", { required: true }),
          text("relationship", "Relationship to you or your spouse", { required: true }),
          money("amount", "Amount of transfer ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ description: "", dateOfTransfer: null, transferredTo: "", relationship: "", amount: null }) satisfies Saca2Transfer,
        addLabel: "Add a transfer",
        itemTitle: "Transfer",
        maxItems: 10,
      },
      { required: true, visibleWhen: anyTransfer, help: "Send proof of each transfer." },
    ),
  ],
}

const deposit = (ctx: Saca2QuestionContext) => supplementA(ctx).facilityDeposit
const gaveDeposit = (ctx: Saca2QuestionContext) => deposit(ctx).gaveDeposit === "yes"

const DEPOSIT_SECTION: Saca2Section = {
  id: "deposit",
  title: "Deposit to a care or residential facility",
  questions: [
    yesNo("supplements.a.facilityDeposit.gaveDeposit", "Have you, your spouse, or someone acting on your behalf given a deposit to any health-care or residential facility, like an assisted-living facility, a continuing-care retirement community, or a life-care community?", {
      required: true,
      help: "If Yes, send a copy of the contract you signed with the facility and any documents about this deposit.",
    }),
    text("supplements.a.facilityDeposit.facilityName", "Name of facility", { required: true, visibleWhen: gaveDeposit }),
    text("supplements.a.facilityDeposit.facilityAddress", "Address of facility", { required: true, visibleWhen: gaveDeposit }),
    money("supplements.a.facilityDeposit.amount", "Amount of deposit ($)", { required: true, visibleWhen: gaveDeposit }),
    yesNo("supplements.a.facilityDeposit.stillHeld", "Does the facility still have the deposit?", { required: true, visibleWhen: gaveDeposit }),
    yesNo("supplements.a.facilityDeposit.returned", "Did the facility return the deposit?", { required: true, visibleWhen: gaveDeposit }),
    text("supplements.a.facilityDeposit.returnedToName", "Name of the person who got the deposit from the facility", {
      required: true,
      visibleWhen: (ctx) => gaveDeposit(ctx) && deposit(ctx).returned === "yes",
    }),
    text("supplements.a.facilityDeposit.returnedToAddress", "Address of the person who got the deposit from the facility", {
      required: true,
      visibleWhen: (ctx) => gaveDeposit(ctx) && deposit(ctx).returned === "yes",
    }),
  ],
}

const home = (ctx: Saca2QuestionContext) => supplementA(ctx).home
const ownsHome = (ctx: Saca2QuestionContext) => home(ctx).ownsHome === "yes"
const isHcbsApplicant = (ctx: Saca2QuestionContext) => supplementA(ctx).applyingHcbsWaiver === "yes"

type RelativeKey = "spouse" | "disabledChild" | "childUnder21" | "sibling" | "caregiverChild" | "dependentRelative"

/** One gate, a name, and "lives in your home?" per relative; some relatives add one more answer. */
function relativeQuestions(
  key: RelativeKey,
  gateLabel: string,
  extras: (has: (ctx: Saca2QuestionContext) => boolean) => Saca2Question[] = () => [],
): Saca2Question[] {
  const base = `supplements.a.home.${key}`
  const has = (ctx: Saca2QuestionContext) => ownsHome(ctx) && home(ctx)[key].has === "yes"
  return [
    yesNo(`${base}.has`, gateLabel, { required: true, visibleWhen: ownsHome }),
    text(`${base}.name`, "Name", { required: true, visibleWhen: has }),
    ...extras(has),
    yesNo(`${base}.livesInHome`, "Is this person living in your home?", { required: true, visibleWhen: has }),
  ]
}

const HOME_SECTION: Saca2Section = {
  id: "home",
  title: "Your home and real estate",
  description:
    "These answers decide whether your real estate counts as an asset or a lien may be placed on it. If the equity in your principal home is over a certain limit, you may not be eligible for payment of long-term-care services unless certain conditions are met.",
  questions: [
    yesNo("supplements.a.home.ownsHome", "Do you or your spouse own or have a legal interest in your home, including a life estate?", { required: true, help: "If No, answer the questions about intending to return home and other real estate only." }),
    repeater(
      "supplements.a.home.properties",
      "Your home",
      {
        questions: [
          text("ownerNames", "Name(s) and address(es) of the person(s) on the ownership papers", { required: true }),
          text("propertyAddress", "Description and address of the property", { required: true }),
          select(
            "ownershipType",
            "Type of ownership",
            opts([
              ["individual", "Individual"],
              ["tenancyInCommon", "Tenancy in common"],
              ["jointTenancy", "Joint tenancy"],
              ["lifeEstate", "Life estate"],
            ]),
            { required: true },
          ),
          money("fairMarketValue", "Fair-market value ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ ownerNames: "", propertyAddress: "", ownershipType: null, fairMarketValue: null }) satisfies HomeProperty,
        addLabel: "Add a property",
        itemTitle: "Property",
        maxItems: 2,
      },
      { required: true, visibleWhen: ownsHome },
    ),
    ...relativeQuestions("spouse", "Do you have a spouse?"),
    ...relativeQuestions("disabledChild", "Do you have a permanently and totally disabled or blind child?"),
    ...relativeQuestions("childUnder21", "Do you have a child under 21 years old?", (has) => [
      date("supplements.a.home.childUnder21.dateOfBirth", "Date of birth", { required: true, visibleWhen: has }),
    ]),
    ...relativeQuestions("sibling", "Do you have a sibling with a legal interest in the home who was living in the home for at least one year immediately before your admission to the medical institution?"),
    ...relativeQuestions("caregiverChild", "Do you have a child who has lived in the home for at least the last two years before your admission to the medical institution and has provided care to you that allowed you to live in the home?"),
    ...relativeQuestions("dependentRelative", "Do you have a dependent relative?", (has) => [
      text("supplements.a.home.dependentRelative.relationshipDescription", "Describe the relationship and the nature of the dependency", { required: true, visibleWhen: has }),
    ]),
    yesNo("supplements.a.intendsToReturnHome", "Do you intend to return to your home?", {
      required: true,
      visibleWhen: (ctx) => !isHcbsApplicant(ctx),
      help: "Do not answer this question if you are applying for a Home- and Community-Based Services Waiver.",
    }),
    yesNo("supplements.a.home.ownsOtherRealEstate", "Do you or your spouse own or have a legal interest in other real estate not listed above?", { required: true }),
    text("supplements.a.home.otherRealEstateDescription", "Describe the property and list its address", {
      required: true,
      visibleWhen: (ctx) => home(ctx).ownsOtherRealEstate === "yes",
    }),
  ],
}

const LTCI_SECTION: Saca2Section = {
  id: "ltci",
  title: "Long-term-care insurance",
  questions: [
    yesNo("supplements.a.longTermCareInsurance.hasPolicy", "Do you or your spouse have long-term-care insurance?", { required: true, help: "If Yes, send a copy of the policy." }),
    repeater(
      "supplements.a.longTermCareInsurance.policies",
      "Policies",
      {
        questions: [
          text("companyAndPolicyNumber", "Company name and policy number", { required: true }),
          text("policyholder", "Policyholder name", { required: true }),
          date("effectiveDate", "Effective date", { required: true }),
          money("premium", "Premium amount ($)", { required: true }),
        ],
        emptyItem: () =>
          ({ companyAndPolicyNumber: "", policyholder: "", effectiveDate: null, premium: null }) satisfies LongTermCarePolicy,
        addLabel: "Add a policy",
        itemTitle: "Policy",
        maxItems: 2,
      },
      { required: true, visibleWhen: (ctx) => supplementA(ctx).longTermCareInsurance.hasPolicy === "yes" },
    ),
  ],
}

const filedAny = (ctx: Saca2QuestionContext) => {
  const filed = supplementA(ctx).taxReturnsFiled
  return filed === "bothYears" || filed === "oneYear"
}

const TAX_SECTION: Saca2Section = {
  id: "tax",
  title: "Tax returns",
  questions: [
    select(
      "supplements.a.taxReturnsFiled",
      "Did you or your spouse file US income tax returns in the last two years?",
      opts([
        ["bothYears", "Yes, both years"],
        ["oneYear", "Yes, one of these years"],
        ["neither", "No, neither year"],
      ]),
      { required: true },
    ),
    yesNo("supplements.a.hasCopiesOfTaxReturns", "Do you have copies of these returns to send?", {
      required: true,
      visibleWhen: filedAny,
      help: "If Yes, you must send copies. If you did not keep copies of one or more of the returns, you must send a filled-out and signed IRS Form 4506 (the form is included with this application).",
    }),
  ],
}

export const SUPPLEMENT_A_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [INTRO_SECTION, FACILITY_SECTION, EXPENSES_SECTION, TRANSFERS_SECTION, DEPOSIT_SECTION, HOME_SECTION, LTCI_SECTION, TAX_SECTION],
}
