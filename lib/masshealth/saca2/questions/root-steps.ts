/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "../age"
import { checkbox, date, email, opts, phone, repeater, select, ssn, text, yesNo } from "./builders"
import { validateStateCode, validateZip } from "./validators"
import type { Saca2QuestionContext, Saca2StepContent } from "./types"

function isSixtyFiveOrAgeUnknown(ctx: Saca2QuestionContext): boolean {
  const age = calculateAge(ctx.answers.persons[0]?.dateOfBirth, ctx.on)
  return age === null || age >= 65
}

export const INTAKE_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "programs",
      title: "What are you applying for?",
      description: "Check every program that applies. MassHealth will check whether anyone on this application is eligible for MassHealth or the Health Safety Net.",
      questions: [
        checkbox("intake.programs.masshealthHsn", "MassHealth or the Health Safety Net (HSN)"),
        checkbox("intake.programs.longTermCare", "Long-term care (nursing home or chronic hospital)"),
        checkbox("intake.programs.hcbsWaiver", "Home- and Community-Based Services (HCBS) Waiver"),
        checkbox("intake.programs.healthConnector", "Health Connector programs"),
        checkbox("intake.applyForSnap", "Also send this application to the Department of Transitional Assistance to apply for SNAP"),
      ],
    },
    {
      id: "screening",
      title: "Which application fits",
      description: "These two questions are not on the printed form. We use them only to check that SACA-2 is the right application.",
      questions: [
        yesNo("screening.disabledAndWorkingQualifies", "Are you disabled and either working 40 or more hours a month, or working now and worked at least 240 hours in the last six months?", {
          visibleWhen: isSixtyFiveOrAgeUnknown,
        }),
        yesNo("screening.commonHealthTenYears", "Have you received MassHealth CommonHealth for 10 years?", {
          visibleWhen: isSixtyFiveOrAgeUnknown,
        }),
      ],
    },
  ],
  validateStep: (answers): Record<string, string> => {
    const { programs } = answers.intake
    const any = programs.masshealthHsn || programs.longTermCare || programs.hcbsWaiver || programs.healthConnector
    return any ? {} : { "intake.programs.masshealthHsn": "Select at least one program." }
  },
}

export const AIAN_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "aian",
      title: "American Indian or Alaska Native household members",
      questions: [
        yesNo("aian.anyMember", "Are you or is anyone in your household an American Indian or Alaska Native?", {
          required: true,
          help: "If Yes, you will complete Supplement B later.",
        }),
      ],
    },
  ],
}

const hasPreviousBills = (ctx: Saca2QuestionContext) => ctx.answers.previousMedicalBills.hasBills === "yes"
const wantsPreviousPeriod = (ctx: Saca2QuestionContext) =>
  hasPreviousBills(ctx) && ctx.answers.previousMedicalBills.wantsCoverageForPeriod === "yes"

export const PREVIOUS_BILLS_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "bills",
      title: "Previous medical bills",
      questions: [
        yesNo("previousMedicalBills.hasBills", "Do you or your spouse have bills for medical services you got in the three months before submitting this application?", {
          required: true,
          help: "If Yes, MassHealth may be able to pay for these bills.",
        }),
        yesNo("previousMedicalBills.wantsCoverageForPeriod", "Do you or your spouse want to apply for MassHealth for that time period?", {
          required: true,
          visibleWhen: hasPreviousBills,
          help: "If Yes, you must give proof of all income and assets owned during that time period.",
        }),
        date("previousMedicalBills.earliestDate", "What is the earliest date for which you need MassHealth?", {
          required: true,
          visibleWhen: wantsPreviousPeriod,
        }),
        repeater(
          "previousMedicalBills.requests",
          "People requesting payment of previous medical bills",
          {
            questions: [
              text("name", "Name", { required: true }),
              date("earliestDateRequested", "Earliest date requested", { required: true }),
              yesNo("circumstancesChanged", "Any change in circumstances during this time?", { required: true }),
            ],
            emptyItem: () => ({ name: "", earliestDateRequested: null, circumstancesChanged: null }),
            addLabel: "Add a person",
            itemTitle: "Person",
            maxItems: 5,
          },
          { required: true, visibleWhen: wantsPreviousPeriod },
        ),
      ],
    },
  ],
}

const applicantAge = (ctx: Saca2QuestionContext) => calculateAge(ctx.answers.persons[0]?.dateOfBirth, ctx.on)
const applicantIsMinor = (ctx: Saca2QuestionContext) => {
  const age = applicantAge(ctx)
  return age !== null && age < 18
}
/** A responsible party signs for a minor who is not emancipated, or whenever chosen as the signer. */
const needsResponsibleParty = (ctx: Saca2QuestionContext) =>
  ctx.answers.signature.signedBy === "responsibleParty" ||
  (applicantIsMinor(ctx) && ctx.answers.signing.emancipatedMinor === "no")

export const SIGNATURE_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "signer",
      title: "Who will sign the application?",
      description: "You sign the printed form yourself. We never sign for you.",
      questions: [
        select(
          "signature.signedBy",
          "The application will be signed by",
          opts([
            ["applicant", "The applicant"],
            ["authorizedRepresentative", "An authorized representative (an Authorized Representative Designation form is required)"],
            ["responsibleParty", "A responsible party (applicant is younger than 18 and not an emancipated minor)"],
          ]),
          { required: true },
        ),
      ],
    },
    {
      id: "beforeSigning",
      title: "Before you sign",
      questions: [
        yesNo("signing.emancipatedMinor", "Are you an emancipated minor?", {
          required: true,
          visibleWhen: applicantIsMinor,
          help: "If No, we need a responsible party who is at least 18 to sign on your behalf.",
        }),
        text("signing.responsibleParty.firstName", "Responsible party: first name", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.middleName", "Middle name", { visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.lastName", "Last name", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.suffix", "Suffix", { visibleWhen: needsResponsibleParty }),
        ssn("signing.responsibleParty.ssn", "Social Security number", { visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.relationship", "Relationship to you", { required: true, visibleWhen: needsResponsibleParty }),
        date("signing.responsibleParty.dateOfBirth", "Date of birth", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.street", "Street address", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.apartment", "Apartment or unit number", { visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.city", "City", { required: true, visibleWhen: needsResponsibleParty }),
        text("signing.responsibleParty.state", "State", { visibleWhen: needsResponsibleParty, validate: validateStateCode }),
        text("signing.responsibleParty.zip", "ZIP code", { required: true, visibleWhen: needsResponsibleParty, validate: validateZip }),
        text("signing.responsibleParty.county", "County", { visibleWhen: needsResponsibleParty }),
        phone("signing.responsibleParty.phone", "Phone", { required: true, visibleWhen: needsResponsibleParty }),
        select(
          "signing.responsibleParty.phoneType",
          "Phone type",
          opts([
            ["mobile", "Mobile"],
            ["home", "Home"],
            ["work", "Work"],
          ]),
          { visibleWhen: needsResponsibleParty },
        ),
        phone("signing.responsibleParty.secondPhone", "Second phone", { visibleWhen: needsResponsibleParty }),
        email("signing.responsibleParty.email", "Email address", { visibleWhen: needsResponsibleParty }),
      ],
    },
    {
      id: "voter",
      title: "Voter registration (optional)",
      description: "If you do not answer, we treat it as no choice to register at this time. Applying to register or declining does not affect your benefits.",
      questions: [
        yesNo("signing.registerToVote", "If you are not registered to vote where you live now, would you like to apply to register to vote today?"),
      ],
    },
  ],
  validateStep: (answers, _personIndex, on): Record<string, string> => {
    const age = calculateAge(answers.persons[0]?.dateOfBirth, on)
    const nonEmancipatedMinor = age !== null && age < 18 && answers.signing.emancipatedMinor === "no"
    return nonEmancipatedMinor && answers.signature.signedBy === "applicant"
      ? { "signature.signedBy": "A responsible party must sign for an applicant who is younger than 18 and not an emancipated minor." }
      : {}
  },
}
