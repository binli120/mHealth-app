/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EmployerJob } from "../types"
import { date, email, money, opts, phone, repeater, select, ssn, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2StepContent } from "./types"
import { PREMIUM_FREQUENCIES } from "./options"
import { validateStateCode, validateZip } from "./validators"

const eligible = (ctx: Saca2QuestionContext) => ctx.item?.eligibleWithinThreeMonths === "yes"
const change = (ctx: Saca2QuestionContext, kind: string) => eligible(ctx) && ctx.item?.upcomingChange === kind

export const SUPPLEMENT_D_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "jobs",
      title: "Health coverage from jobs",
      description:
        "Answer these questions if someone in the household is eligible for health coverage from a job, whether or not they are enrolled. Add one entry for each job that offers coverage.",
      questions: [
        repeater(
          "supplements.d.jobs",
          "Jobs that offer coverage",
          {
            questions: [
              text("employeeName", "Employee name (first, middle, last)", { required: true }),
              ssn("employeeSsn", "Employee Social Security number"),
              yesNo("eligibleWithinThreeMonths", "Is at least one person on this application currently eligible for or enrolled in coverage offered by this employer, or will at least one person become eligible within the next 3 months?", {
                required: true,
                help: "If No, stop here and skip the rest of this entry.",
              }),
              date("waitingPeriodEnds", "If any person is in a waiting or probationary period, when can this person enroll in coverage?", { visibleWhen: eligible }),
              text("employerName", "Employer name", { required: true, visibleWhen: eligible }),
              text("employerFederalTaxId", "Federal Tax ID (if known)", { visibleWhen: eligible }),
              text("employerAddress", "Employer address", { visibleWhen: eligible }),
              text("employerCity", "City", { visibleWhen: eligible }),
              text("employerState", "State", { visibleWhen: eligible, validate: validateStateCode }),
              text("employerZip", "ZIP code", { visibleWhen: eligible, validate: validateZip }),
              phone("employerPhone", "Employer phone number", { visibleWhen: eligible }),
              text("contactName", "Who can we contact about employee health coverage at this job?", { visibleWhen: eligible }),
              phone("contactPhone", "Contact phone number (if different from above)", { visibleWhen: eligible }),
              email("contactEmail", "Contact email address", { visibleWhen: eligible }),
              text("individualPlanName", "Name of the lowest-cost individual health plan offered to the employee", { required: true, visibleWhen: eligible }),
              yesNo("individualMeetsMinimumValue", "Does this plan meet the minimum value standard for coverage?", {
                required: true,
                visibleWhen: eligible,
                help: "A plan meets the minimum value standard if the plan's share of the total allowed benefit costs covered by the plan is at least 60 percent of such costs.",
              }),
              money("individualPremium", "How much would this employee pay in premiums for this plan? ($)", { required: true, visibleWhen: eligible }),
              select("individualPremiumFrequency", "How often would the employee pay this amount?", PREMIUM_FREQUENCIES, { required: true, visibleWhen: eligible }),
              text("familyPlanName", "Name of the lowest-cost health plan to cover the other household members who qualify through the employer", { visibleWhen: eligible }),
              yesNo("familyMeetsMinimumValue", "Does this plan meet the minimum value standard for coverage?", {
                visibleWhen: (ctx) => eligible(ctx) && typeof ctx.item?.familyPlanName === "string" && ctx.item.familyPlanName.trim() !== "",
              }),
              money("familyPremium", "How much would this employee pay in premiums for this plan? ($)", {
                visibleWhen: (ctx) => eligible(ctx) && typeof ctx.item?.familyPlanName === "string" && ctx.item.familyPlanName.trim() !== "",
              }),
              select("familyPremiumFrequency", "How often would the employee pay this amount?", PREMIUM_FREQUENCIES, {
                visibleWhen: (ctx) => eligible(ctx) && typeof ctx.item?.familyPlanName === "string" && ctx.item.familyPlanName.trim() !== "",
              }),
              select(
                "upcomingChange",
                "What change will the employer make for the new plan year (if known)?",
                opts([
                  ["none", "No change"],
                  ["employerWillNotOffer", "Employer will not offer health coverage"],
                  ["personWillDrop", "The person plans to drop the employer's health coverage"],
                  ["employerWillChange", "Employer will start offering coverage or change the premium for the lowest-cost plans"],
                ]),
                { required: true, visibleWhen: eligible },
              ),
              date("changeEndDate", "Coverage end date", {
                required: true,
                visibleWhen: (ctx) => change(ctx, "employerWillNotOffer") || change(ctx, "personWillDrop"),
              }),
              money("changePremium", "How much would this employee pay in premiums for this plan? ($)", {
                required: true,
                visibleWhen: (ctx) => change(ctx, "employerWillChange"),
              }),
              select("changePremiumFrequency", "How often?", PREMIUM_FREQUENCIES, {
                required: true,
                visibleWhen: (ctx) => change(ctx, "employerWillChange"),
              }),
              date("changeDate", "Date of change", { required: true, visibleWhen: (ctx) => change(ctx, "employerWillChange") }),
            ],
            emptyItem: () =>
              ({
                employeeName: "",
                employeeSsn: "",
                eligibleWithinThreeMonths: null,
                waitingPeriodEnds: null,
                employerName: "",
                employerFederalTaxId: "",
                employerAddress: "",
                employerCity: "",
                employerState: "MA",
                employerZip: "",
                employerPhone: "",
                contactName: "",
                contactPhone: "",
                contactEmail: "",
                individualPlanName: "",
                individualMeetsMinimumValue: null,
                individualPremium: null,
                individualPremiumFrequency: null,
                familyPlanName: "",
                familyMeetsMinimumValue: null,
                familyPremium: null,
                familyPremiumFrequency: null,
                upcomingChange: "none",
                changeEndDate: null,
                changePremium: null,
                changePremiumFrequency: null,
                changeDate: null,
              }) satisfies EmployerJob,
            addLabel: "Add a job",
            itemTitle: "Job",
            maxItems: 4,
          },
          { required: true },
        ),
      ],
    },
  ],
}
