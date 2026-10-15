/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EmployerCoverageEntry, HraEntry, MedicareEntry } from "../types"
import { checkbox, date, money, opts, repeater, select, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2StepContent } from "./types"

const health = (ctx: Saca2QuestionContext) => ctx.answers.health
const hasOtherCoverage = (ctx: Saca2QuestionContext) => health(ctx).hasOtherCoverage === "yes"
const hasMedicare = (ctx: Saca2QuestionContext) => hasOtherCoverage(ctx) && health(ctx).hasMedicare
const wantsPartBHelp = (ctx: Saca2QuestionContext) => hasMedicare(ctx) && health(ctx).wantsPartBHelp === "yes"
const anyOtherProgram = (ctx: Saca2QuestionContext) =>
  hasOtherCoverage(ctx) && Object.values(health(ctx).otherPrograms).some(Boolean)
const enrolledInEmployerCoverage = (ctx: Saca2QuestionContext) =>
  hasOtherCoverage(ctx) && health(ctx).enrolledInEmployerCoverage

export const HEALTH_INSURANCE_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "employer",
      title: "Coverage offered through a job",
      description:
        "MassHealth rules require members to get and keep available health insurance, including insurance available through an employer. We may ask you and your employer for more information.",
      questions: [
        yesNo("health.employerOfferedCoverage", "Was anyone listed on this application offered health coverage from a job but is not enrolled in it?", {
          required: true,
          help: "Answer Yes even if the insurance is from another person, like a spouse, even if that person does not live in the household. If Yes, you will complete Supplement D.",
        }),
      ],
    },
    {
      id: "coverage",
      title: "Current health coverage",
      questions: [
        yesNo("health.hasOtherCoverage", "Does anyone qualify for or is anyone enrolled in the following types of health coverage?", {
          required: true,
          help: "Answer Yes even if this insurance is from another person, like a spouse, even if that person does not live in the household.",
        }),
        checkbox("health.hasMedicare", "Enrolled in Medicare or qualifies for a Medicare Part A plan with no premium", { visibleWhen: hasOtherCoverage }),
        repeater(
          "health.medicare",
          "Medicare",
          {
            questions: [
              text("personName", "Name of person covered", { required: true }),
              text("claimNumber", "Medicare claim number", { required: true }),
              date("coverageStart", "When did coverage start?", { required: true }),
              yesNo("hasPartD", "Does this person have a Medicare Part D plan?", { required: true }),
              date("partDStart", "When did Part D coverage start?", { visibleWhen: (ctx) => ctx.item?.hasPartD === "yes" }),
              yesNo("hasMedigap", "Does this person have a Medigap/Medicare supplemental policy?", { required: true }),
              text("medigapPlan", "Name of coverage plan", { required: true, visibleWhen: (ctx) => ctx.item?.hasMedigap === "yes" }),
              date("medigapStart", "When did the Medigap coverage start?", { visibleWhen: (ctx) => ctx.item?.hasMedigap === "yes" }),
            ],
            emptyItem: () =>
              ({
                personName: "",
                claimNumber: "",
                coverageStart: null,
                hasPartD: null,
                partDStart: null,
                hasMedigap: null,
                medigapPlan: "",
                medigapStart: null,
              }) satisfies MedicareEntry,
            addLabel: "Add a person with Medicare",
            itemTitle: "Person with Medicare",
            maxItems: 4,
          },
          { required: true, visibleWhen: hasMedicare },
        ),
        yesNo("health.wantsPartBHelp", "Do any of the people above want to apply for help paying for their Medicare Part B premiums?", {
          required: true,
          visibleWhen: hasMedicare,
        }),
        text("health.partBHelpNames", "Name(s) of the people who want help paying Part B premiums", {
          required: true,
          visibleWhen: wantsPartBHelp,
        }),
        checkbox("health.otherPrograms.peaceCorps", "Qualifies for Peace Corps coverage", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.tricare", "Qualifies for TRICARE (do not check if you have direct care or Line of Duty)", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.vaHealth", "Enrolled in Veterans Affairs (VA) health programs", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.masshealth", "Enrolled in MassHealth", { visibleWhen: hasOtherCoverage }),
        checkbox("health.otherPrograms.otherCoverage", "Other coverage (including COBRA and retiree health plans)", { visibleWhen: hasOtherCoverage }),
        text("health.otherCoverageDetails.coveredNames", "Name(s) of covered household members", { required: true, visibleWhen: anyOtherProgram }),
        text("health.otherCoverageDetails.policyNumber", "Policy number or member ID", { required: true, visibleWhen: anyOtherProgram }),
        text("health.otherCoverageDetails.startEndDates", "Start date and end date (mm/dd/yyyy)", { visibleWhen: anyOtherProgram }),
        checkbox("health.enrolledInEmployerCoverage", "Enrolled in employer coverage (you must also complete Supplement D)", { visibleWhen: hasOtherCoverage }),
        repeater(
          "health.employerCoverage",
          "Employer coverage",
          {
            questions: [
              text("employerName", "Name of employer", { required: true }),
              text("planName", "Plan name", { required: true }),
              text("coveredNames", "Name(s) of covered household members", { required: true }),
              text("policyNumber", "Policy number or member ID"),
              text("startEndDates", "Start date and end date (mm/dd/yyyy)"),
            ],
            emptyItem: () =>
              ({ employerName: "", planName: "", coveredNames: "", policyNumber: "", startEndDates: "" }) satisfies EmployerCoverageEntry,
            addLabel: "Add employer coverage",
            itemTitle: "Employer coverage",
            maxItems: 4,
          },
          { required: true, visibleWhen: enrolledInEmployerCoverage },
        ),
      ],
    },
  ],
  validateStep: (answers): Record<string, string> => {
    const { hasOtherCoverage: gate, hasMedicare: medicare, otherPrograms, enrolledInEmployerCoverage: employer } = answers.health
    if (gate !== "yes") return {}
    const anyType = medicare || employer || Object.values(otherPrograms).some(Boolean)
    return anyType ? {} : { "health.hasOtherCoverage": "Select the type of coverage." }
  },
}

const hraEntry = (ctx: Saca2QuestionContext, type: "qsehra" | "ichra") => ctx.item?.hraType === type

export const HRA_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "hra",
      title: "Health reimbursement arrangements (HRAs)",
      questions: [
        yesNo("health.hra.anyoneOffered", "Is anyone in the household offered a Health Reimbursement Arrangement (HRA) from their employer?", { required: true }),
        repeater(
          "health.hra.entries",
          "HRAs offered",
          {
            questions: [
              text("individualName", "Name of individual", { required: true }),
              date("dateOfBirth", "Date of birth", { required: true }),
              text("employerName", "Employer name", { required: true }),
              text("federalTaxId", "Federal tax ID"),
              select(
                "hraType",
                "Type of HRA offered by the employer",
                opts([
                  ["qsehra", "Qualified Small Employer Health Reimbursement Arrangement (QSEHRA)"],
                  ["ichra", "Individual Coverage Health Reimbursement Arrangement (ICHRA)"],
                ]),
                { required: true },
              ),
              date("startDate", "Start date"),
              date("endDate", "End date"),
              money("maxSelfOnlyAmount", "Maximum yearly self-only coverage benefit amount ($)", { required: true }),
              yesNo("qsehraFamilyIntent", "Do you intend to use QSEHRA family coverage benefits from your employer?", {
                required: true,
                visibleWhen: (ctx) => hraEntry(ctx, "qsehra"),
              }),
              money("qsehraFamilyMax", "Maximum yearly family coverage benefit amount through the QSEHRA ($)", {
                required: true,
                visibleWhen: (ctx) => hraEntry(ctx, "qsehra") && ctx.item?.qsehraFamilyIntent === "yes",
              }),
              yesNo("ichraAcceptIntent", "Does anyone in the household intend to accept an ICHRA benefit from their employer?", {
                required: true,
                visibleWhen: (ctx) => hraEntry(ctx, "ichra"),
              }),
            ],
            emptyItem: () =>
              ({
                individualName: "",
                dateOfBirth: null,
                employerName: "",
                federalTaxId: "",
                hraType: null,
                startDate: null,
                endDate: null,
                maxSelfOnlyAmount: null,
                qsehraFamilyIntent: null,
                qsehraFamilyMax: null,
                ichraAcceptIntent: null,
              }) satisfies HraEntry,
            addLabel: "Add an HRA",
            itemTitle: "HRA",
            maxItems: 2,
          },
          { required: true, visibleWhen: (ctx) => ctx.answers.health.hra.anyoneOffered === "yes" },
        ),
      ],
    },
  ],
}
