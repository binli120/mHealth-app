/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FamilyMemberAtHome, Saca2Transfer } from "../types"
import { isStepVisible } from "../visibility"
import { date, money, repeater, ssn, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"

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

export const SUPPLEMENT_A_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [INTRO_SECTION, FACILITY_SECTION, EXPENSES_SECTION, TRANSFERS_SECTION, DEPOSIT_SECTION],
}
