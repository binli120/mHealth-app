/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Encoder } from "../types"
import type { PersonColumn, PersonRow } from "./person-table"

const YES_NO_1_2 = { kind: "yesNo", yes: "1", no: "2" } as const
const CHECK = { kind: "check" } as const

const one = (field: string, encode: Encoder): PersonColumn => ({ fields: [field], encode })

/**
 * Person 2's copy of a question: a field name (same kind of encoding as Person 1's) or a field with
 * its own encoder where the form's on-states or widget differ from Person 1's.
 */
type P2 = string | readonly [field: string, encode: Encoder]
const p2Column = (p2: P2 | undefined, encode: Encoder): PersonColumn | undefined =>
  p2 === undefined ? undefined : typeof p2 === "string" ? one(p2, encode) : one(p2[0], p2[1])
const withP2 = (row: PersonRow, p2: P2 | undefined, encode: Encoder): PersonRow => {
  const column = p2Column(p2, encode)
  return column ? { ...row, p2: column } : row
}

const answer = (path: string, field: string, encode: Encoder, p2?: P2): PersonRow =>
  withP2({ path, stepId: "person1", p1: one(field, encode) }, p2, encode)
const derived = (id: string, field: string, encode: Encoder, p2?: P2): PersonRow =>
  withP2({ derived: id, stepId: "person1", p1: one(field, encode) }, p2, encode)
const item = (path: string, index: number, key: string, field: string, encode: Encoder, p2?: P2): PersonRow =>
  withP2({ item: { path, index, key }, stepId: "person1", p1: one(field, encode) }, p2, encode)

/** The form's own box for one frequency value: every frequency box is its own /On checkbox. */
const frequencyBox = (id: string, frequency: string, field: string, p2?: string): PersonRow =>
  derived(id, field, { kind: "pick", states: { [frequency]: "On" } }, p2)

/**
 * Person 1 on form pages 4-6 (PDF indexes 5-7) plus the end of the deductions and the yearly income
 * at the top of page 7 (index 8), and Person 2's counterparts: the rest of Person 2's tax section
 * (index 9), citizenship through accommodations (index 10), SSI and income (index 11), the lottery
 * line through the deductions (index 12) and the yearly income (index 13, form page 12). Income is
 * rows in the wizard but fixed blocks on the form; the `income.*` derived values pick the first row
 * of each kind (see derived-income.ts) for the person the column belongs to.
 */
export const PERSON1_B_ROWS: PersonRow[] = [
  // Q11e tax filer (top of form page 4), the abuse question and the optional APTC statement (Person 2: Q21d-e)
  answer("tax.taxFiler.dateOfBirth", "tax filer DOB", "date", "21d. Tax filer date of birth"),
  answer("tax.taxFiler.relationship", "How are you related to the tax filer?", "text", "21d. How is this person related to the tax filer_P2"),
  answer(
    "tax.taxFiler.marriedFilingJointly",
    "Is the tax filer married, filing a joint return?",
    YES_NO_1_2,
    "21d. Is the tax filer married, filing a joint return?_P2",
  ),
  derived(
    "tax.filerSpouseNameAndDob",
    "If Yes list name of spouse and date of birth",
    "text",
    "21d. If Yes, list name of spouse and date of birth._P2",
  ),
  answer(
    "tax.taxFiler.otherDependents",
    "Who else does the tax filer claim as dependents?",
    "text",
    "21d. Who else does the tax filer claim as dependents?_P2",
  ),
  answer(
    "tax.filingSeparatelyAbuse",
    "Are you filing taxes separately because you are a victim of domestic abuse or abandonment?",
    YES_NO_1_2,
    "21e. Is this person filing taxes separately because they are a victim of domestic abuse or abandonment?_P2",
  ),
  // the one box with Yes = /On and No = /2; printed once, in Person 1's block (no Person 2 copy)
  answer("tax.filedForAptcYears", "Premium Tax Credit (APTC)", { kind: "yesNo", yes: "On", no: "2" }),

  // Q12 citizenship (Person 2: Q22)
  answer("usCitizenOrNational", "12. Are you a U.S. citizen or U.S. national?", YES_NO_1_2, "22. Is this person a U.S. citizen or U.S. national?_P2"),
  answer(
    "naturalizedCitizen",
    "are you a naturalized, derived, or acquired citizen (not born in the US)?",
    YES_NO_1_2,
    "22. If Yes, are they a naturalized, derived, or acquired citizen (not born in the U.S.)?",
  ),
  answer("alienNumber", "Alien number", "text", "22 Alien number_P2"),
  answer(
    "citizenshipCertificateNumber",
    "Naturalization or citizenship certificate number",
    "text",
    "22 Naturalization or citizenship certificate number_P2",
  ),

  // Q13 immigration (Person 2: Q23 a-e; 13f has four category boxes and the wizard one Yes/No: left unmapped)
  answer(
    "hasEligibleImmigrationStatus",
    "13. do you have an eligible immigration status?",
    YES_NO_1_2,
    "23.  If this person is a noncitizen, do they have an eligible immigration status?",
  ),
  answer("isLprCheCofa", "Are you a Lawful Permanent Resident?", YES_NO_1_2, "23a. Is this person a Lawful Permanent Resident?"),
  derived("immigration.hasDocument", "Do you have an immigration document?", YES_NO_1_2, "23b. Does this person have an immigration document?"),
  answer("immigrationStatusDate", "Status award date mmddyyyy", "date", "Status award date mmddyyyy_P2"),
  derived("immigration.statusLabel", "Immigration status", "text", "Immigration status_P2"),
  derived("immigration.documentTypeLabel", "Immigration document type", "text", "Immigration document type_P2"),
  answer("immigrationDocumentId", "Document ID number", "text", "Document ID number_P2"),
  answer("immigrationDocumentExpiry", "Passport or document expiration date mmddyyyy", "date", "Passport or document expiration date mmddyyyy_P2"),
  answer("immigrationCountry", "Country", "text", "Country_P2"),
  answer(
    "immigrationSameName",
    "Did you use the same name on this application that you did to get your immigration status?",
    YES_NO_1_2,
    "23c. Did this person use the same name on this application to get their immigration status?",
  ),
  answer(
    "immigrationOtherName",
    "If No what name did you use First middle last and suffix",
    "text",
    "If No what name did this person use First middle last and suffix",
  ),
  answer("arrivedAfterAug1996", "Did you arrive in the U.S. after August 22, 1996?", YES_NO_1_2, "23d. Did this person arrive in the U.S. after August 22, 1996?"),
  answer("isVeteranOrMilitaryFamily", "Are you an honorably discharged veteran?", YES_NO_1_2, "23e. Is this person an honorably discharged veteran?"),

  // Q14-17 residency, caregiver, pregnancy, foster care (Person 2: Q24-27)
  answer("residentOfMassachusetts", "14. Are you living in Massachusetts?", YES_NO_1_2, "24. Is this person living in Massachusetts?"),
  answer("caregiverOfChildUnder19", "15. Do you live with at least one child younger than age 19?", YES_NO_1_2, "25. Does this person live with at least one child?"),
  derived("household.caregiverChildren", "Namess and dates of birth of children", "text", "Namess and dates of birth of children_P2"),
  answer("pregnant", "16. Are you pregnant?", YES_NO_1_2, "26. Is this person pregnant?"),
  answer("babiesExpected", "If Yes how many babies are you expecting", "number", "If Yes how many babies are they expecting"),
  answer("dueDate", "What is the expected due date", "date", "What is the expected due date_2"),
  answer("everInFosterCare", "17. Were you ever in foster care?", YES_NO_1_2, "27. Was this person ever in foster care?"),
  answer("fosterCareState", "If Yes in what state were you in foster care", "upper", "If Yes in what state was this person in foster care?_P2"),
  answer(
    "fosterCareMedicaid",
    "Were you getting health care through a state Medicaid program?",
    YES_NO_1_2,
    "Was this person getting health care through a state Medicaid program?",
  ),

  // Q18-20: rent or own, disability, accommodations (form page 5; Person 2: Q28-30)
  answer("rentOrOwn", "18. Do you rent or own your property?", { kind: "pick", states: { rent: "1", own: "2" } }, [
    "28. Does this person rent or own their property?",
    { kind: "pick", states: { rent: "1", own: "2" } },
  ]),
  answer("hasDisability", "19. Do you have a disability?", YES_NO_1_2, "29. Does this person have a disability?"),
  answer(
    "needsAccommodation",
    "20. Do you need reasonable accommodation(s) because of a disability or injury?",
    YES_NO_1_2,
    "30. Does this person need reasonable accommodation(s) because of a disability or injury?",
  ),
  answer("accommodationConditions.lowVision", "Low vision", CHECK, "Low vision_P2"),
  answer("accommodationConditions.blind", "Blind", CHECK, "Blind_P2"),
  answer("accommodationConditions.deaf", "Deaf", CHECK, "Deaf_P2"),
  answer("accommodationConditions.hardOfHearing", "Hard of hearing", CHECK, "Hard of hearing_P2"),
  answer("accommodationConditions.developmentallyDisabled", "Developmentally disabled", CHECK, "Developmentally disabled_P2"),
  answer("accommodationConditions.intellectuallyDisabled", "Intellectually disabled", CHECK, "Intellectually disabled_P2"),
  answer("accommodationConditions.physicallyDisabled", "Physically disabled", CHECK, "Physically disabled_P2"),
  answer("accommodationConditions.other", "Other Please explain", CHECK, "30. Other_P2"),
  answer("accommodationConditionOther", "20a. Explain Other", "text", "30a Other Please explain_P2"),
  answer("accommodations.tty", "Text telephone TTY", CHECK, "Text telephone TTY_P2"),
  answer("accommodations.largePrint", "Largeprint publications", CHECK, "Largeprint publications_P2"),
  answer("accommodations.asl", "American Sign Language interpreter", CHECK, "American Sign Language interpreter_P2"),
  answer("accommodations.videoRelay", "Video Relay Service", CHECK, "Video Relay Service_P2"),
  answer("accommodations.cart", "Communication Access Realtime Translations CART", CHECK, "Communication Access Realtime Translations CART_P2"),
  answer("accommodations.braille", "Publications in braille", CHECK, "Publications in braille_P2"),
  answer("accommodations.assistiveListening", "Assistive listening device", CHECK, "Assistive listening device_P2"),
  answer("accommodations.electronicFormat", "Publications in electronic format", CHECK, "Publications in electronic format_P2"),
  answer("accommodations.other", "Other Please explain_2", CHECK, "30b. Other_P2"),
  answer("accommodationOther", "20b. Explain Other", "text", "30b Other Please explain_P2"),

  // Q21 SSI history (Person 2: Q31; its No box is the group's /On widget, Yes is /1)
  answer("everGotSsi", "21. Did you ever get Supplemental Security Income (SSI)?", YES_NO_1_2, [
    "31. Did this person ever get Supplemental Security Income (SSI)?",
    { kind: "yesNo", yes: "1", no: "On" },
  ]),
  answer("lastSsiMonth", "When did you last get SSI mmyyyy", "text", "31a. When did this person last get SSI mmyyyy"),
  answer(
    "livingArrangement",
    "21b. Do you live alone, with a spouse, at rest home or someone else's home?",
    {
      kind: "pick",
      states: { alone: "1", withSpouse: "2", restHome: "3", someoneElsesHome: "4" },
    },
    [
      "31b. Does the person live alone, with a spouse, at rest home or someone else's home?",
      { kind: "pick", states: { alone: "1", withSpouse: "2", restHome: "3", someoneElsesHome: "4" } },
    ],
  ),

  // Q22 income, Q23-26 current job (the first wages row); Person 2: Q32-36
  answer("hasIncome", "22. Do you have any income?", YES_NO_1_2, "32. Does this person have any income?"),
  derived("income.wages.employer", "23. Employer name and address", "text", "33. Employer name and address_P2"),
  derived("income.wages.taxId", "Federal Tax ID", "text", "Federal Tax ID_P2"),
  derived("income.wages.amount", "24a.  Wagestips before taxes", "money", "34a.  Wagestips before taxes"),
  frequencyBox("income.wages.frequency", "weekly", "Weekly", "34a. Weekly_3"),
  frequencyBox("income.wages.frequency", "every2weeks", "Every 2 weeks", "34a. Every 2 weeks_2"),
  frequencyBox("income.wages.frequency", "twiceMonthly", "Twice a month", "34a. Twice a month_3"),
  frequencyBox("income.wages.frequency", "monthly", "Monthly", "34a. Monthly_3"),
  frequencyBox("income.wages.frequency", "quarterly", "Quarterly", "34a. Quarterly_2"),
  frequencyBox(
    "income.wages.frequency",
    "yearly",
    "Yearly Subtract any pretax deductions such as nontaxable health insurance premiums",
    "34a. Yearly Subtract any pretax deductions such as nontaxable health insurance premiums_2",
  ),
  derived("income.wages.effectiveDate", "24b.  Income effective date", "date", "34b.  Income effective date_2"),
  derived("income.wages.hoursPerWeek", "25. Average number of hours worked each WEEK", "number", "35. Average number of hours worked each WEEK"),
  derived("income.wages.seasonal", "26. Are you seasonally employed?", YES_NO_1_2, "36. Is this person seasonally employed?"),
  derived("income.wages.month.jan", "Jan", CHECK, "Jan_2"),
  derived("income.wages.month.feb", "Feb", CHECK, "Feb_2"),
  derived("income.wages.month.mar", "March", CHECK, "March_2"),
  derived("income.wages.month.apr", "April", CHECK, "April_2"),
  derived("income.wages.month.may", "May", CHECK, "May_2"),
  derived("income.wages.month.jun", "June", CHECK, "June_2"),
  derived("income.wages.month.jul", "July", CHECK, "July_2"),
  derived("income.wages.month.aug", "August", CHECK, "August_2"),
  derived("income.wages.month.sep", "Sept", CHECK, "Sept_2"),
  derived("income.wages.month.oct", "Oct", CHECK, "Oct_2"),
  derived("income.wages.month.nov", "Nov", CHECK, "Nov_2"),
  derived("income.wages.month.dec", "Dec", CHECK, "Dec_2"),

  // Q27 self-employment (Person 2: Q37). The template names Person 1's two blanks of 27b confusingly; by
  // position the first (after "...each month? $") is the monthly profit and the second (after
  // "/month profit or $") the loss. Person 2's blanks are named by what they hold.
  derived("income.selfEmployment.answer", "27. Are you self-employed?", YES_NO_1_2, "37. Is this person self-employed?"),
  derived("income.selfEmployment.work", "If Yes what type of work do you do", "text", "37a. If Yes what type of work does this person do"),
  derived("income.selfEmployment.profit", "or how much will you lose from this selfemployment each month", "money", "37b. each month profit"),
  derived("income.selfEmployment.loss", "month profit or", "money", "37b. each month loss"),
  derived("income.selfEmployment.hoursPerWeek", "How many hours do you work per week", "number", "37c. How many hours does this person work per week"),

  // Q28 other income (Person 2: Q38): a box, an amount and a "How often?" line per type
  ...otherIncomeLine(
    "socialSecurity",
    ["28. Social Security benefits", "Social Security benefits  $", "How often Social Security benefits"],
    ["38. Social Security benefits_P2", "38.  Social Security benefits_2_P2", "38. Social Security benefits How often_P2"],
  ),
  ...otherIncomeLine(
    "pension",
    ["28. Retirement or Pension", "Retirement or Pension   $", "How often Retirement or Pension"],
    ["38. Retirement or Pension_P2", "38. Retirement or Pension_2_P2", "38. Retirement or Pension How often__P2"],
  ),
  derived("income.pension.source", "Retirement or Pension Source", "text", "38. Retirement or Source__P2"),
  ...otherIncomeLine(
    "annuity",
    ["28. Annuities", "Annuities   $", "How often Annuities"],
    ["38. Annuities_P2", "38. Annuities_2_P2", "38. AnnuitiesHow often_P2"],
  ),
  ...otherIncomeLine(
    "trust",
    ["28. Trusts", "Trusts   $", "How often Trusts"],
    ["38. Trusts_P2", "38. Trusts_2_P2", "38. Trusts How often_P2"],
  ),
  ...otherIncomeLine(
    "unemployment",
    ["28. Unemployment", "Unemployment   $", "How often Unemployment"],
    ["38. Unemployment_P2", "38. Unemployment_2_P2", "38. Unemployment How often_P2"],
  ),
  ...otherIncomeLine(
    "investment",
    [
      "29 Interest dividends and other investment income",
      "Interest, dividends, and other investment income   $",
      "How often Interest, dividends, and other investment income",
    ],
    [
      "38.  Interest dividends and other investment income_P2",
      "38. Interest dividends and other investment income_2_P2",
      "38. Interest dividends and other investment income How often_P2",
    ],
  ),
  ...otherIncomeLine(
    "royalty",
    ["Royalty income", "Royalty income   $", "How often Royalty income"],
    ["38. Royalty income_P2", "38. Royalty income_2_P2", "38. Royalty income_How often_P2"],
  ),
  ...otherIncomeLine(
    "alimony",
    ["Alimony received", "Alimony received   $", "How often Alimony received"],
    ["38. Alimony received_2_P2", "38. Alimony received   $_P2", "38. Alimony received   How often_P2"],
  ),
  derived("income.alimony.preTcja", "$", "money", "38. January 1 2019 enter the amount of those payments here_P2"),
  ...otherIncomeLine(
    "veterans",
    ["Federal veterans benefits", "Federal veteran’s benefits   $", "How often Federal veteran’s benefits"],
    ["38. Federal veterans benefits_2_P2", "38. Federal veteran’s benefits   $_P2", "38. Federal veteran’s benefits How often_P2"],
  ),
  ...otherIncomeLine(
    "militaryRetirement",
    ["Military retirement pay", "Military retirement pay   $", "How often Military retirement pay"],
    ["38. Military retirement pay_2_P2", "38. Military retirement pay   $_P2", "38. Military retirement pay How often_P2"],
  ),
  ...otherIncomeLine(
    "otherTaxable",
    ["Other taxable income include type", "Other taxable income   $", "How often Other taxable income"],
    ["38. Other taxable income include type_2_P2", "38. Other taxable income $_P2", "38. Other taxable income How often_2_P2"],
  ),
  derived("income.otherTaxable.type", "Other taxable income Type", "text", "38. Other taxable income Type_2_P2"),

  // Capital gains and farming/fishing: a monthly profit or loss, no frequency
  derived(
    "income.capitalGains.checked",
    "Capital gains On average how much net income or loss will you get from this capital gain each month",
    CHECK,
    "38. Capital gains On average how much net income or loss will this person get from this capital gain each month_P2",
  ),
  derived("income.capitalGains.profit", "Capital gains profit $", "money", "38. Capital gains profit $_P2"),
  derived("income.capitalGains.loss", "Capital gains loss $", "money", "38. Capital gains loss $_P2"),
  derived("income.farmingFishing.checked", "Net farming or fishing income", CHECK, "38. Net farming or fishing income_2_P2"),
  derived("income.farmingFishing.profit", "Net farming or fishing income profit $", "money", "38. Net farming or fishing income profit_P2"),
  derived("income.farmingFishing.loss", "Net farming or fishing income loss $", "money", "38. Net farming or fishing income loss_P2"),
  derived(
    "income.farmingFishing.hoursPerWeek",
    "How many hours  Net farming or fishing income each week",
    "number",
    "38. Net farming or fishing How many hours each week_P2",
  ),

  // Lottery and gambling winnings: amount, effective date and its own How-often boxes (no quarterly box)
  derived("income.lottery.checked", "Lottery and Gambling Winnings", CHECK, "38. Lottery and Gambling Winnings_2_P2"),
  derived("income.lottery.amount", "Lottery and Gambling Winnings   $", "money", "38. Lottery and Gambling Winnings $_P2"),
  derived("income.lottery.effectiveDate", "Lottery and Gambling Winnings Effective Date", "date", "38. Lottery and Gambling Winnings Date_P2"),
  frequencyBox("income.lottery.frequency", "oneTime", "One time only", "One time only_2"),
  frequencyBox("income.lottery.frequency", "weekly", "Weekly_2", "Weekly_4"),
  frequencyBox("income.lottery.frequency", "every2weeks", "Every two weeks", "Every two weeks_2"),
  frequencyBox("income.lottery.frequency", "twiceMonthly", "Twice a month_2", "Twice a month_4"),
  frequencyBox("income.lottery.frequency", "monthly", "Monthly_2", "Monthly_4"),
  frequencyBox("income.lottery.frequency", "yearly", "Yearly", "Yearly_2"),

  // Q29 rental income (Person 2: Q39): the type boxes, then the form's two unit lines (more units need an overflow sheet)
  answer("rental.hasRentalIncome", "29. Do you get rental income?", YES_NO_1_2, "39. Does this person get rental income?"),
  answer("rental.realEstateType", "onefamily", { kind: "pick", states: { oneFamily: "On" } }, "39a. onefamily_2"),
  answer("rental.realEstateType", "twofamily", { kind: "pick", states: { twoFamily: "On" } }, "39a. twofamily_2"),
  answer("rental.realEstateType", "threefamily", { kind: "pick", states: { threeFamily: "On" } }, "39a. threefamily_2"),
  answer("rental.realEstateType", "other describe", { kind: "pick", states: { other: "On" } }, "39a. other describe_2"),
  answer(
    "rental.realEstateTypeOther",
    "How much monthly rental income or loss do you get from each rental unit from the real estate indicated above",
    "text",
    "39a. Describe other",
  ),
  ...rentalUnit(
    0,
    ["29b. Address", "29b. Unit", "29b. Amount of Income", "29b. Amount of Loss", "29b. Owner-occupied?"],
    ["39b. Address_P2", "39b. Unit_P2", "39b. Amount of Income_3", "39b. Amount of Loss_3", "39b. Owner-occupied?"],
  ),
  ...rentalUnit(
    1,
    ["29b. Address_2", "29b. Unit_2", "29b. Amount of Income_2", "29b. Amount of Loss_2", "29b. Owner-occupied?_2"],
    ["39b. Address_4", "39b. Unit_4", "39b. Amount of Income_4", "39b. Amount of Loss_4", "39b. Owner-occupied?_2"],
  ),
  answer(
    "rental.paysHeatOrUtilities",
    "29c. Do you pay for heat or utilities for your tenant?",
    YES_NO_1_2,
    "39c. Does this person pay for heat or utilities for their tenant?",
  ),

  // Q30 and Q31 one-time-only income (Person 2: Q40-41): one line each (more payments need an overflow sheet)
  answer(
    "oneTimeIncome.thisYear",
    "30. Have you or will you receive income during this calendar year as a one-time only payment?",
    YES_NO_1_2,
    "40. Has or will this person receive income during this calendar year as a one-time only payment?",
  ),
  item("oneTimeIncome.thisYearItems", 0, "type", "If Yes  Type", "text", "40. If Yes  Type_3"),
  item("oneTimeIncome.thisYearItems", 0, "amount", "Amount", "money", "40. Amount_3"),
  item("oneTimeIncome.thisYearItems", 0, "month", "Month Received", "number", "40. Month Received_3"),
  item("oneTimeIncome.thisYearItems", 0, "year", "Year received", "number", "40. Year received_3"),
  // Person 1's template splits Q31's Yes and No into two single-widget fields (/1 and /2); Person 2's is one group
  answer(
    "oneTimeIncome.nextYear",
    "31. Will you receive income during the next calendar year as a one-time only payment?",
    { kind: "pick", states: { yes: "1" } },
    ["41. Will this person receive income during the next calendar year as a one-time only payment?", YES_NO_1_2],
  ),
  answer(
    "oneTimeIncome.nextYear",
    "32. Will you receive income during the next calendar year as a one-time only payment?",
    { kind: "pick", states: { no: "2" } },
  ),
  item("oneTimeIncome.nextYearItems", 0, "type", "If Yes  Type_2", "text", "41. If Yes  Type_4"),
  item("oneTimeIncome.nextYearItems", 0, "amount", "Amount_2", "money", "41. Amount_4"),
  item("oneTimeIncome.nextYearItems", 0, "month", "Month Received_2", "number", "41. Month Received_4"),
  item("oneTimeIncome.nextYearItems", 0, "year", "Year received_2", "number", "41. Year received_4"),

  // Q32 deductions (Person 2: Q42): a box ticked per amount given, then "None"; the end of Person 1's list is on form page 7 (index 8).
  // Eight of these amount fields are one field shared by both people's pages in the raw template. The
  // fill splits them (split-shared-fields.ts): the Person 1 names keep Person 1's widgets only and
  // Person 2's amounts are the `<name>__p2` fields.
  ...deduction(
    "educator",
    ["Educator expense Yearly amount", "ducator expense: Yearly amount $"],
    ["Educator expense Yearly amount_2", "Educator expense: Yearly amount $"],
  ),
  ...deduction(
    "reservistExpenses",
    [
      "Certain business expenses of reservists performing artists or feebased government officials Yearly amount",
      "Certain business expenses of reservists, performing artists, or fee-based government officials: Yearly amount $",
    ],
    ["Certain business expenses of reservists performing artists or feebased government officials Yearly amount_2", "Certain business expenses yearly amont"],
  ),
  ...deduction(
    "hsa",
    ["Health Savings Account deduction Yearly amount", "Health Savings Account deduction: Yearly amount $"],
    ["Health Savings Account deduction Yearly amount_2", "Health Savings Account deduction: Yearly amount $__p2"],
  ),
  ...deduction(
    "movingExpenses",
    ["Moving expenses for members of the Armed Forces Yearly amount", "Moving expenses for members of the Armed Forces: Yearly amount $"],
    ["Moving expenses for members of the Armed Forces Yearly amount_2", "Moving expenses for members of the Armed Forces: Yearly amount $__p2"],
  ),
  ...deduction(
    "selfEmploymentTax",
    ["Deductible part of selfemployment tax Yearly amount", "Deductible part of self-employment tax: Yearly amount $"],
    ["Deductible part of selfemployment tax Yearly amount_2", "Deductible part of self-employment tax: Yearly amount $__p2"],
  ),
  ...deduction(
    "selfEmployedRetirement",
    [
      "Contribution to selfemployed SEP SIMPLE and qualified plans Yearly amount",
      "Contribution to self-employed SEP, SIMPLE, and qualified plans: Yearly amount $",
    ],
    [
      "Contribution to selfemployed SEP SIMPLE and qualified plans Yearly amount_2",
      "Contribution to self-employed SEP, SIMPLE, and qualified plans: Yearly amount $__p2",
    ],
  ),
  ...deduction(
    "selfEmployedHealthInsurance",
    ["Selfemployed health insurance deduction Yearly amount", "Self-employed health insurance deduction: Yearly amount $"],
    ["Selfemployed health insurance deduction Yearly amount_2", "Self-employed health insurance deduction: Yearly amount $__p2"],
  ),
  ...deduction(
    "earlyWithdrawalPenalty",
    ["Penalty on early withdrawal of savings Yearly amount", "Penalty on early withdrawal of savings: Yearly amount $"],
    ["Penalty on early withdrawal of savings Yearly amount_2", "Penalty on early withdrawal of savings: Yearly amount $__p2"],
  ),
  ...deduction(
    "alimonyPaid",
    [
      "Alimony paid alimony payments for a divorce separation agreement or court order that was finalized before January 1 2019",
      "Alimony paid $",
    ],
    [
      "Alimony paid If this person paid alimony payments for a divorce separation agreement or court order that was finalized",
      "Alimony paid Yearly amount",
    ],
  ),
  ...deduction(
    "ira",
    ["Individual Retirement Account IRA deduction Yearly amount", "Individual Retirement Account (IRA) deduction: Yearly amount $"],
    ["Individual Retirement Account IRA deduction Yearly amount_2", "Individual Retirement Account (IRA) deduction: Yearly amount $__p2"],
  ),
  ...deduction(
    "studentLoanInterest",
    ["Student loan deduction interest only not total payment Yearly amount", "Student loan deduction (interest only, not total payment): Yearly amount $"],
    [
      "Student loan deduction interest only not total payment Yearly amount_2",
      "Student loan deduction (interest only, not total payment): Yearly amount $__p2",
    ],
  ),
  answer("deductions.none", "None", CHECK, "None_2"),

  // Q33 and Q34 yearly income (Person 2: Q43-44, the top of form page 12 = index 13)
  answer(
    "expectedIncomeThisYear",
    "33. What is your total expected income for the current calendar year?",
    "money",
    "43. What is your total expected income for the current calendar year?_P2",
  ),
  answer(
    "expectedIncomeNextYear",
    "34. What is your total expected income for next calendar year, if different?",
    "money",
    "44. What is your total expected income for next calendar year, if different?_P2",
  ),
]

type FieldTriple = readonly [box: string, amount: string, howOften: string]

/** One "check / $ amount / How often?" line of Q28; the frequency is written as the form's own wording. */
function otherIncomeLine(kind: string, p1: FieldTriple, p2: FieldTriple): PersonRow[] {
  return [
    derived(`income.${kind}.checked`, p1[0], CHECK, p2[0]),
    derived(`income.${kind}.amount`, p1[1], "money", p2[1]),
    derived(`income.${kind}.frequencyText`, p1[2], "text", p2[2]),
  ]
}

type RentalFields = readonly [address: string, unit: string, income: string, loss: string, owner: string]

/** One rental unit line of Q29b; the amount goes into the Income or the Loss blank by the unit's `isLoss`. */
function rentalUnit(index: number, p1: RentalFields, p2: RentalFields): PersonRow[] {
  return [
    item("rental.units", index, "address", p1[0], "text", p2[0]),
    item("rental.units", index, "unit", p1[1], "text", p2[1]),
    derived(`rental.unit.${index}.income`, p1[2], "money", p2[2]),
    derived(`rental.unit.${index}.loss`, p1[3], "money", p2[3]),
    item("rental.units", index, "ownerOccupied", p1[4], YES_NO_1_2, p2[4]),
  ]
}

type DeductionFields = readonly [box: string, amount: string]

/** One deduction of Q32: its box is ticked when a yearly amount is given. */
function deduction(key: string, p1: DeductionFields, p2: DeductionFields): PersonRow[] {
  return [
    derived(`deductions.${key}.checked`, p1[0], CHECK, p2[0]),
    answer(`deductions.amounts.${key}`, p1[1], "money", p2[1]),
  ]
}
