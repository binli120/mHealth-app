/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "../age"
import { checkbox, opts, select, yesNo } from "./builders"
import type { Saca2StepContent } from "./types"

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
          visibleWhen: (ctx) => {
            const age = calculateAge(ctx.answers.persons[0]?.dateOfBirth, ctx.on)
            return age === null || age >= 65
          },
        }),
        yesNo("screening.commonHealthTenYears", "Have you received MassHealth CommonHealth for 10 years?", {
          visibleWhen: (ctx) => {
            const age = calculateAge(ctx.answers.persons[0]?.dateOfBirth, ctx.on)
            return age === null || age >= 65
          },
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
      ],
    },
  ],
}

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
  ],
}
