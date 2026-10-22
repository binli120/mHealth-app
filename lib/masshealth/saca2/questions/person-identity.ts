/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { date, text, yesNo } from "./builders"
import { applying, noncitizen, person, who } from "./person-context"
import type { Saca2Question, Saca2QuestionContext } from "./types"

const hasSsn = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.hasSsn === "yes"
const hasEligibleStatus = (ctx: Saca2QuestionContext) =>
  noncitizen(ctx) && person(ctx)?.hasEligibleImmigrationStatus === "yes"

/** Form Q10: the name on the Social Security card. Inserted after `noSsnReason`. */
export const SSN_CARD_QUESTIONS: Saca2Question[] = [
  yesNo(
    "nameMatchesSsnCard",
    who(
      "Is your name on this application the same as your name on your Social Security card?",
      "Is this person's name on this application the same as their name on their Social Security card?",
    ),
    { required: hasSsn, visibleWhen: hasSsn },
  ),
  text("ssnCardName", "Name on the Social Security card (first, middle, last, and suffix)", {
    required: true,
    visibleWhen: (ctx) => hasSsn(ctx) && person(ctx)?.nameMatchesSsnCard === "no",
  }),
]

/** Form Q13a-f: immigration details. Inserted after `immigrationDocumentExpiry`. */
export const IMMIGRATION_DETAIL_QUESTIONS: Saca2Question[] = [
  yesNo(
    "isLprCheCofa",
    who(
      "Are you a Lawful Permanent Resident (LPR or green card holder), a Cuban-Haitian Entrant (CHE), or a Compact of Free Association (COFA) Migrant?",
      "Is this person a Lawful Permanent Resident (LPR or green card holder), a Cuban-Haitian Entrant (CHE), or a Compact of Free Association (COFA) Migrant?",
    ),
    { required: hasEligibleStatus, visibleWhen: hasEligibleStatus },
  ),
  date("immigrationStatusDate", "Status award date (for battered persons, the date the petition was approved)", {
    visibleWhen: hasEligibleStatus,
  }),
  text("immigrationCountry", "Country (on the passport or document)", { visibleWhen: hasEligibleStatus }),
  yesNo(
    "immigrationSameName",
    who(
      "Did you use the same name on this application that you did to get your immigration status?",
      "Did this person use the same name on this application that they used to get their immigration status?",
    ),
    { required: noncitizen, visibleWhen: noncitizen },
  ),
  text("immigrationOtherName", "Name used to get immigration status (first, middle, last, and suffix)", {
    required: true,
    visibleWhen: (ctx) => noncitizen(ctx) && person(ctx)?.immigrationSameName === "no",
  }),
  yesNo(
    "arrivedAfterAug1996",
    who("Did you arrive in the U.S. after August 22, 1996?", "Did this person arrive in the U.S. after August 22, 1996?"),
    { required: noncitizen, visibleWhen: noncitizen },
  ),
  yesNo(
    "isVeteranOrMilitaryFamily",
    who(
      "Are you an honorably discharged veteran or active-duty member of the US military, or the spouse or child of one?",
      "Is this person an honorably discharged veteran or active-duty member of the US military, or the spouse or child of one?",
    ),
    { required: noncitizen, visibleWhen: noncitizen },
  ),
  yesNo(
    "isTraffickingOrBatteredVictim",
    who(
      "Optional: Are you a victim of severe trafficking; a spouse, child, sibling, or parent of a trafficking victim; a battered spouse; or a child or parent of a battered spouse?",
      "Optional: Is this person a victim of severe trafficking; a spouse, child, sibling, or parent of a trafficking victim; a battered spouse; or a child or parent of a battered spouse?",
    ),
    { visibleWhen: noncitizen },
  ),
]
