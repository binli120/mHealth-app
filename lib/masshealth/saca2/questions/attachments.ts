/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { date, email, opts, phone, repeater, select, text, yesNo } from "./builders"
import type { Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"
import { validateStateCode, validateZip } from "./validators"

const ard = (ctx: Saca2QuestionContext) => ctx.answers.attachments.ard
const sectionChosen = (ctx: Saca2QuestionContext) => ard(ctx).section !== null
const isOrganizationDesignation = (ctx: Saca2QuestionContext) =>
  ard(ctx).section === "applicantDesignates" && ard(ctx).repKind === "organization"
const section2NamesOrganization = (ctx: Saca2QuestionContext) =>
  ard(ctx).section === "cannotDesignate" && ard(ctx).orgName.trim() !== ""

const REPRESENTATIVE_SECTION: Saca2Section = {
  id: "representative",
  title: "Authorized representative",
  description:
    "An authorized representative can act on the applicant's behalf in all matters with MassHealth and the Health Connector until the designation ends. The applicant's own name, date of birth, and contact details are taken from your answers earlier in this application.",
  questions: [
    select(
      "attachments.ard.section",
      "How is the authorized representative being designated?",
      opts([
        ["applicantDesignates", "Section 1: the applicant designates the representative in writing"],
        ["cannotDesignate", "Section 2: the applicant cannot designate in writing (a person who will act responsibly on their behalf)"],
        ["appointedByLaw", "Section 3: the representative was appointed by law (guardian, conservator, power of attorney, health care proxy, or estate representative)"],
      ]),
      { required: true },
    ),
    select(
      "attachments.ard.repKind",
      "Is the representative a person or an organization?",
      opts([
        ["person", "A person"],
        ["organization", "An organization"],
      ]),
      { required: true, visibleWhen: (ctx) => ard(ctx).section === "applicantDesignates" },
    ),
    text("attachments.ard.repName", "Authorized representative's name", { required: true, visibleWhen: sectionChosen }),
    phone("attachments.ard.repPhone", "Authorized representative's phone number", { required: true, visibleWhen: sectionChosen }),
    text("attachments.ard.repStreet", "Street address", { required: true, visibleWhen: sectionChosen }),
    text("attachments.ard.repCity", "City", { required: true, visibleWhen: sectionChosen }),
    text("attachments.ard.repState", "State", { visibleWhen: sectionChosen, validate: validateStateCode }),
    text("attachments.ard.repZip", "ZIP code", { required: true, visibleWhen: sectionChosen, validate: validateZip }),
    email("attachments.ard.repEmail", "Authorized representative's email address", { visibleWhen: sectionChosen }),
    text("attachments.ard.orgName", "Organization name (if the representative is acting for an organization)", {
      required: isOrganizationDesignation,
      visibleWhen: (ctx) => isOrganizationDesignation(ctx) || ard(ctx).section === "cannotDesignate",
    }),
    text("attachments.ard.staffName", "Printed name of the provider, staff member, or volunteer completing the form", {
      required: true,
      visibleWhen: isOrganizationDesignation,
    }),
    email("attachments.ard.staffEmail", "Email of the provider, staff member, or volunteer completing the form", {
      required: true,
      visibleWhen: isOrganizationDesignation,
    }),
    text("attachments.ard.officerName", "Name of the officer who signs for the organization", { required: true, visibleWhen: section2NamesOrganization }),
    text("attachments.ard.officerTitle", "Officer's title", { required: true, visibleWhen: section2NamesOrganization }),
    text("attachments.ard.legalDocument", "Legal document that gives this person authority (for example guardianship order, power of attorney, health care proxy, or estate appointment)", {
      required: true,
      visibleWhen: (ctx) => ard(ctx).section === "appointedByLaw",
      help: "Send a copy of the applicable legal document with this form.",
    }),
  ],
}

export const ARD_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [REPRESENTATIVE_SECTION],
}

const noSsnOnFile = (ctx: Saca2QuestionContext) => ctx.answers.persons[0]?.hasSsn !== "yes"

export const IRS4506_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "irs4506",
      title: "Request for copy of tax return (IRS Form 4506)",
      description:
        "Use this if you did not keep copies of the tax returns you filed. We fill in your name, address, and Social Security number from your earlier answers. The IRS may take up to 75 calendar days to respond, and there is a fee for each return.",
      questions: [
        yesNo("attachments.irs4506.jointReturn", "Was the return filed jointly with your spouse?", { required: true }),
        text("attachments.irs4506.taxpayerId", "Taxpayer identification number (ITIN)", {
          required: true,
          visibleWhen: noSsnOnFile,
          help: "Needed because no Social Security number was entered for Person 1.",
        }),
        text("attachments.irs4506.previousAddress", "Previous address shown on the last return filed, if different from your current address"),
        text("attachments.irs4506.formNumber", "Tax form number", { required: true, help: "Individual returns are Form 1040." }),
        repeater(
          "attachments.irs4506.yearsRequested",
          "Years or periods requested",
          {
            questions: [date("periodEnd", "Ending date of the tax year or period (mm/dd/yyyy)", { required: true })],
            emptyItem: () => ({ periodEnd: null }),
            addLabel: "Add a year",
            itemTitle: "Year",
            maxItems: 4,
          },
          { required: true },
        ),
      ],
    },
  ],
}
