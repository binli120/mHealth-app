/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FamilyMemberAtHome } from "../types"
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

export const SUPPLEMENT_A_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [INTRO_SECTION, FACILITY_SECTION, EXPENSES_SECTION],
}
