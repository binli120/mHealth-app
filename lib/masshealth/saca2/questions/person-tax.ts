/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { date, repeater, text, yesNo } from "./builders"
import { applying, person, who } from "./person-context"
import type { TaxDependent } from "../types"
import type { Saca2QuestionContext, Saca2Section } from "./types"

const agrees = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.tax.agreesToFileIfAptc === "yes"
const agreesAndMarried = (ctx: Saca2QuestionContext) => agrees(ctx) && person(ctx)?.isLegallyMarried === "yes"
const claimsDependents = (ctx: Saca2QuestionContext) => agrees(ctx) && person(ctx)?.tax.claimsDependents === "yes"
const claimed = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.tax.claimedAsDependent === "yes"
const filerJoint = (ctx: Saca2QuestionContext) => claimed(ctx) && person(ctx)?.tax.taxFiler.marriedFilingJointly === "yes"

/** Form Q11 (Person 2: Q21) a-e: federal tax filing for the Health Connector. */
export const TAX_SECTION: Saca2Section = {
  id: "tax",
  title: "Tax filing and the Health Connector",
  questions: [
    yesNo(
      "tax.agreesToFileIfAptc",
      who(
        "If you get an Advance Premium Tax Credit (APTC), do you agree to file a federal tax return for the tax year when the credits are received?",
        "If this person gets an Advance Premium Tax Credit (APTC), does this person agree to file a federal tax return for the tax year that the credits are received?",
      ),
      {
        required: applying,
        visibleWhen: applying,
        help: who(
          "You must check Yes to be eligible for ConnectorCare or APTCs to help pay for your health insurance. You do NOT need to file a tax return to apply for or to get MassHealth or HSN, if you qualify.",
          "You must check Yes to be eligible for ConnectorCare or APTCs to help pay for this person's health insurance. This person does NOT need to file a tax return to apply for or to get MassHealth or HSN, if they qualify.",
        ),
      },
    ),
    text("tax.spouseName", "Spouse's name", { required: true, visibleWhen: agreesAndMarried }),
    date("tax.spouseDateOfBirth", "Spouse's date of birth", { required: true, visibleWhen: agreesAndMarried }),
    yesNo(
      "tax.plansJointReturn",
      who(
        "Do you plan to file a joint federal tax return with your spouse for the tax year for which you are applying?",
        "Does this person plan to file a joint federal tax return with a spouse for the tax year for which this person is applying?",
      ),
      { required: agreesAndMarried, visibleWhen: agreesAndMarried },
    ),
    yesNo(
      "tax.claimsDependents",
      who(
        "Will you claim any dependents on your federal income tax return for the year for which you are applying?",
        "Will this person claim any dependents on this person's federal income tax return for the year for which this person is applying?",
      ),
      { required: agrees, visibleWhen: agrees },
    ),
    repeater(
      "tax.dependents",
      "Dependents",
      {
        questions: [
          text("name", "Dependent's name", { required: true }),
          date("dateOfBirth", "Dependent's date of birth", { required: true }),
        ],
        emptyItem: () => ({ name: "", dateOfBirth: null }) satisfies TaxDependent,
        addLabel: "Add a dependent",
        itemTitle: "Dependent",
        maxItems: 6,
      },
      { required: claimsDependents, visibleWhen: claimsDependents },
    ),
    yesNo(
      "tax.claimedAsDependent",
      who(
        "Will you be claimed as a dependent on someone else's federal income tax return for the year for which you are applying?",
        "Will this person be claimed as a dependent on someone else's federal income tax return for the year for which this person is applying?",
      ),
      {
        required: applying,
        visibleWhen: applying,
        help: who(
          "Do not answer Yes if you are a child younger than 21 being claimed by a non-custodial parent.",
          "Do not answer Yes if this person is a child younger than 21 being claimed by a non-custodial parent.",
        ),
      },
    ),
    text("tax.taxFiler.name", "Tax filer's name", { required: true, visibleWhen: claimed }),
    date("tax.taxFiler.dateOfBirth", "Tax filer's date of birth", { required: true, visibleWhen: claimed }),
    text(
      "tax.taxFiler.relationship",
      who("How are you related to the tax filer?", "How is this person related to the tax filer?"),
      { required: true, visibleWhen: claimed },
    ),
    yesNo("tax.taxFiler.marriedFilingJointly", "Is the tax filer married, filing a joint return?", {
      required: claimed,
      visibleWhen: claimed,
    }),
    text("tax.taxFiler.spouseName", "Tax filer's spouse's name", { required: true, visibleWhen: filerJoint }),
    date("tax.taxFiler.spouseDateOfBirth", "Tax filer's spouse's date of birth", { required: true, visibleWhen: filerJoint }),
    text("tax.taxFiler.otherDependents", "Who else does the tax filer claim as dependents?", { visibleWhen: claimed }),
    yesNo(
      "tax.filingSeparatelyAbuse",
      who(
        "Are you filing taxes separately because you are a victim of domestic abuse or abandonment?",
        "Is this person filing taxes separately because they are a victim of domestic abuse or abandonment?",
      ),
      { required: applying, visibleWhen: applying },
    ),
    // Printed once in Person 1's block of the form; it covers the whole household.
    yesNo(
      "tax.filedForAptcYears",
      "I filed a federal income tax return with the Internal Revenue Service (IRS) for each year in the past two years that I received an Advance Premium Tax Credit (APTC) to lower my monthly premium payment, including if I was enrolled in ConnectorCare. I included the tax forms showing the tax credits I received when I filed my tax return so the IRS could calculate how much Advance Premium Tax Credit I was eligible to receive based on my final income for the year.",
      {
        visibleWhen: (ctx) => applying(ctx) && ctx.personIndex === 0,
        help: "Optional. Answer Yes if: 1. You have received an APTC or ConnectorCare in the past, and 2. The statement is true for all people listed in the household.",
      },
    ),
  ],
}
