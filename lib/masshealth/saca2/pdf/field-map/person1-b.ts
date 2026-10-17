/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Encoder } from "../types"
import type { PersonColumn, PersonRow } from "./person-table"

const YES_NO_1_2 = { kind: "yesNo", yes: "1", no: "2" } as const
const CHECK = { kind: "check" } as const

const one = (field: string, encode: Encoder): PersonColumn => ({ fields: [field], encode })
const answer = (path: string, field: string, encode: Encoder): PersonRow => ({ path, stepId: "person1", p1: one(field, encode) })
const derived = (id: string, field: string, encode: Encoder): PersonRow => ({ derived: id, stepId: "person1", p1: one(field, encode) })
const item = (path: string, index: number, key: string, field: string, encode: Encoder): PersonRow => ({
  item: { path, index, key },
  stepId: "person1",
  p1: one(field, encode),
})

/** The form's own box for one frequency value: every frequency box is its own /On checkbox. */
const frequencyBox = (id: string, frequency: string, field: string): PersonRow =>
  derived(id, field, { kind: "pick", states: { [frequency]: "On" } })

/**
 * Person 1 on form pages 4-6 (PDF indexes 5-7) plus the end of the deductions and the yearly income
 * at the top of page 7 (index 8). Income is rows in the wizard but fixed blocks on the form; the
 * `income.*` derived values pick the first row of each kind (see derived-income.ts).
 */
export const PERSON1_B_ROWS: PersonRow[] = [
  // Q11e tax filer (top of form page 4), the abuse question and the optional APTC statement
  answer("tax.taxFiler.dateOfBirth", "tax filer DOB", "date"),
  answer("tax.taxFiler.relationship", "How are you related to the tax filer?", "text"),
  answer("tax.taxFiler.marriedFilingJointly", "Is the tax filer married, filing a joint return?", YES_NO_1_2),
  derived("tax.filerSpouseNameAndDob", "If Yes list name of spouse and date of birth", "text"),
  answer("tax.taxFiler.otherDependents", "Who else does the tax filer claim as dependents?", "text"),
  answer(
    "tax.filingSeparatelyAbuse",
    "Are you filing taxes separately because you are a victim of domestic abuse or abandonment?",
    YES_NO_1_2,
  ),
  // the one box with Yes = /On and No = /2
  answer("tax.filedForAptcYears", "Premium Tax Credit (APTC)", { kind: "yesNo", yes: "On", no: "2" }),

  // Q12 citizenship
  answer("usCitizenOrNational", "12. Are you a U.S. citizen or U.S. national?", YES_NO_1_2),
  answer("naturalizedCitizen", "are you a naturalized, derived, or acquired citizen (not born in the US)?", YES_NO_1_2),
  answer("alienNumber", "Alien number", "text"),
  answer("citizenshipCertificateNumber", "Naturalization or citizenship certificate number", "text"),

  // Q13 immigration (a-e; 13f has four category boxes and the wizard one Yes/No: left unmapped)
  answer("hasEligibleImmigrationStatus", "13. do you have an eligible immigration status?", YES_NO_1_2),
  answer("isLprCheCofa", "Are you a Lawful Permanent Resident?", YES_NO_1_2),
  derived("immigration.hasDocument", "Do you have an immigration document?", YES_NO_1_2),
  answer("immigrationStatusDate", "Status award date mmddyyyy", "date"),
  derived("immigration.statusLabel", "Immigration status", "text"),
  derived("immigration.documentTypeLabel", "Immigration document type", "text"),
  answer("immigrationDocumentId", "Document ID number", "text"),
  answer("immigrationDocumentExpiry", "Passport or document expiration date mmddyyyy", "date"),
  answer("immigrationCountry", "Country", "text"),
  answer(
    "immigrationSameName",
    "Did you use the same name on this application that you did to get your immigration status?",
    YES_NO_1_2,
  ),
  answer("immigrationOtherName", "If No what name did you use First middle last and suffix", "text"),
  answer("arrivedAfterAug1996", "Did you arrive in the U.S. after August 22, 1996?", YES_NO_1_2),
  answer("isVeteranOrMilitaryFamily", "Are you an honorably discharged veteran?", YES_NO_1_2),

  // Q14-17 residency, caregiver, pregnancy, foster care
  answer("residentOfMassachusetts", "14. Are you living in Massachusetts?", YES_NO_1_2),
  answer("caregiverOfChildUnder19", "15. Do you live with at least one child younger than age 19?", YES_NO_1_2),
  derived("household.caregiverChildren", "Namess and dates of birth of children", "text"),
  answer("pregnant", "16. Are you pregnant?", YES_NO_1_2),
  answer("babiesExpected", "If Yes how many babies are you expecting", "number"),
  answer("dueDate", "What is the expected due date", "date"),
  answer("everInFosterCare", "17. Were you ever in foster care?", YES_NO_1_2),
  answer("fosterCareState", "If Yes in what state were you in foster care", "upper"),
  answer("fosterCareMedicaid", "Were you getting health care through a state Medicaid program?", YES_NO_1_2),

  // Q18-20: rent or own, disability, accommodations (form page 5)
  answer("rentOrOwn", "18. Do you rent or own your property?", { kind: "pick", states: { rent: "1", own: "2" } }),
  answer("hasDisability", "19. Do you have a disability?", YES_NO_1_2),
  answer("needsAccommodation", "20. Do you need reasonable accommodation(s) because of a disability or injury?", YES_NO_1_2),
  answer("accommodationConditions.lowVision", "Low vision", CHECK),
  answer("accommodationConditions.blind", "Blind", CHECK),
  answer("accommodationConditions.deaf", "Deaf", CHECK),
  answer("accommodationConditions.hardOfHearing", "Hard of hearing", CHECK),
  answer("accommodationConditions.developmentallyDisabled", "Developmentally disabled", CHECK),
  answer("accommodationConditions.intellectuallyDisabled", "Intellectually disabled", CHECK),
  answer("accommodationConditions.physicallyDisabled", "Physically disabled", CHECK),
  answer("accommodationConditions.other", "Other Please explain", CHECK),
  answer("accommodationConditionOther", "20a. Explain Other", "text"),
  answer("accommodations.tty", "Text telephone TTY", CHECK),
  answer("accommodations.largePrint", "Largeprint publications", CHECK),
  answer("accommodations.asl", "American Sign Language interpreter", CHECK),
  answer("accommodations.videoRelay", "Video Relay Service", CHECK),
  answer("accommodations.cart", "Communication Access Realtime Translations CART", CHECK),
  answer("accommodations.braille", "Publications in braille", CHECK),
  answer("accommodations.assistiveListening", "Assistive listening device", CHECK),
  answer("accommodations.electronicFormat", "Publications in electronic format", CHECK),
  answer("accommodations.other", "Other Please explain_2", CHECK),
  answer("accommodationOther", "20b. Explain Other", "text"),

  // Q21 SSI history
  answer("everGotSsi", "21. Did you ever get Supplemental Security Income (SSI)?", YES_NO_1_2),
  answer("lastSsiMonth", "When did you last get SSI mmyyyy", "text"),
  answer("livingArrangement", "21b. Do you live alone, with a spouse, at rest home or someone else's home?", {
    kind: "pick",
    states: { alone: "1", withSpouse: "2", restHome: "3", someoneElsesHome: "4" },
  }),

  // Q22 income, Q23-26 current job (the first wages row)
  answer("hasIncome", "22. Do you have any income?", YES_NO_1_2),
  derived("income.wages.employer", "23. Employer name and address", "text"),
  derived("income.wages.taxId", "Federal Tax ID", "text"),
  derived("income.wages.amount", "24a.  Wagestips before taxes", "money"),
  frequencyBox("income.wages.frequency", "weekly", "Weekly"),
  frequencyBox("income.wages.frequency", "every2weeks", "Every 2 weeks"),
  frequencyBox("income.wages.frequency", "twiceMonthly", "Twice a month"),
  frequencyBox("income.wages.frequency", "monthly", "Monthly"),
  frequencyBox("income.wages.frequency", "quarterly", "Quarterly"),
  frequencyBox("income.wages.frequency", "yearly", "Yearly Subtract any pretax deductions such as nontaxable health insurance premiums"),
  derived("income.wages.effectiveDate", "24b.  Income effective date", "date"),
  derived("income.wages.hoursPerWeek", "25. Average number of hours worked each WEEK", "number"),
  derived("income.wages.seasonal", "26. Are you seasonally employed?", YES_NO_1_2),
  derived("income.wages.month.jan", "Jan", CHECK),
  derived("income.wages.month.feb", "Feb", CHECK),
  derived("income.wages.month.mar", "March", CHECK),
  derived("income.wages.month.apr", "April", CHECK),
  derived("income.wages.month.may", "May", CHECK),
  derived("income.wages.month.jun", "June", CHECK),
  derived("income.wages.month.jul", "July", CHECK),
  derived("income.wages.month.aug", "August", CHECK),
  derived("income.wages.month.sep", "Sept", CHECK),
  derived("income.wages.month.oct", "Oct", CHECK),
  derived("income.wages.month.nov", "Nov", CHECK),
  derived("income.wages.month.dec", "Dec", CHECK),

  // Q27 self-employment. The template names the two blanks of 27b confusingly; by position the first
  // (after "...each month? $") is the monthly profit and the second (after "/month profit or $") the loss.
  derived("income.selfEmployment.answer", "27. Are you self-employed?", YES_NO_1_2),
  derived("income.selfEmployment.work", "If Yes what type of work do you do", "text"),
  derived("income.selfEmployment.profit", "or how much will you lose from this selfemployment each month", "money"),
  derived("income.selfEmployment.loss", "month profit or", "money"),
  derived("income.selfEmployment.hoursPerWeek", "How many hours do you work per week", "number"),

  // Q28 other income: a box, an amount and a "How often?" line per type
  ...otherIncomeLine("socialSecurity", "28. Social Security benefits", "Social Security benefits  $", "How often Social Security benefits"),
  ...otherIncomeLine("pension", "28. Retirement or Pension", "Retirement or Pension   $", "How often Retirement or Pension"),
  derived("income.pension.source", "Retirement or Pension Source", "text"),
  ...otherIncomeLine("annuity", "28. Annuities", "Annuities   $", "How often Annuities"),
  ...otherIncomeLine("trust", "28. Trusts", "Trusts   $", "How often Trusts"),
  ...otherIncomeLine("unemployment", "28. Unemployment", "Unemployment   $", "How often Unemployment"),
  ...otherIncomeLine(
    "investment",
    "29 Interest dividends and other investment income",
    "Interest, dividends, and other investment income   $",
    "How often Interest, dividends, and other investment income",
  ),
  ...otherIncomeLine("royalty", "Royalty income", "Royalty income   $", "How often Royalty income"),
  ...otherIncomeLine("alimony", "Alimony received", "Alimony received   $", "How often Alimony received"),
  derived("income.alimony.preTcja", "$", "money"),
  ...otherIncomeLine("veterans", "Federal veterans benefits", "Federal veteran’s benefits   $", "How often Federal veteran’s benefits"),
  ...otherIncomeLine("militaryRetirement", "Military retirement pay", "Military retirement pay   $", "How often Military retirement pay"),
  ...otherIncomeLine("otherTaxable", "Other taxable income include type", "Other taxable income   $", "How often Other taxable income"),
  derived("income.otherTaxable.type", "Other taxable income Type", "text"),

  // Capital gains and farming/fishing: a monthly profit or loss, no frequency
  derived(
    "income.capitalGains.checked",
    "Capital gains On average how much net income or loss will you get from this capital gain each month",
    CHECK,
  ),
  derived("income.capitalGains.profit", "Capital gains profit $", "money"),
  derived("income.capitalGains.loss", "Capital gains loss $", "money"),
  derived("income.farmingFishing.checked", "Net farming or fishing income", CHECK),
  derived("income.farmingFishing.profit", "Net farming or fishing income profit $", "money"),
  derived("income.farmingFishing.loss", "Net farming or fishing income loss $", "money"),
  derived("income.farmingFishing.hoursPerWeek", "How many hours  Net farming or fishing income each week", "number"),

  // Lottery and gambling winnings: amount, effective date and its own How-often boxes (no quarterly box)
  derived("income.lottery.checked", "Lottery and Gambling Winnings", CHECK),
  derived("income.lottery.amount", "Lottery and Gambling Winnings   $", "money"),
  derived("income.lottery.effectiveDate", "Lottery and Gambling Winnings Effective Date", "date"),
  frequencyBox("income.lottery.frequency", "oneTime", "One time only"),
  frequencyBox("income.lottery.frequency", "weekly", "Weekly_2"),
  frequencyBox("income.lottery.frequency", "every2weeks", "Every two weeks"),
  frequencyBox("income.lottery.frequency", "twiceMonthly", "Twice a month_2"),
  frequencyBox("income.lottery.frequency", "monthly", "Monthly_2"),
  frequencyBox("income.lottery.frequency", "yearly", "Yearly"),

  // Q29 rental income: the type boxes, then the form's two unit lines (more units need an overflow sheet)
  answer("rental.hasRentalIncome", "29. Do you get rental income?", YES_NO_1_2),
  answer("rental.realEstateType", "onefamily", { kind: "pick", states: { oneFamily: "On" } }),
  answer("rental.realEstateType", "twofamily", { kind: "pick", states: { twoFamily: "On" } }),
  answer("rental.realEstateType", "threefamily", { kind: "pick", states: { threeFamily: "On" } }),
  answer("rental.realEstateType", "other describe", { kind: "pick", states: { other: "On" } }),
  answer(
    "rental.realEstateTypeOther",
    "How much monthly rental income or loss do you get from each rental unit from the real estate indicated above",
    "text",
  ),
  ...rentalUnit(0, "29b. Address", "29b. Unit", "29b. Amount of Income", "29b. Amount of Loss", "29b. Owner-occupied?"),
  ...rentalUnit(1, "29b. Address_2", "29b. Unit_2", "29b. Amount of Income_2", "29b. Amount of Loss_2", "29b. Owner-occupied?_2"),
  answer("rental.paysHeatOrUtilities", "29c. Do you pay for heat or utilities for your tenant?", YES_NO_1_2),

  // Q30 and Q31 one-time-only income: one line each (more payments need an overflow sheet)
  answer("oneTimeIncome.thisYear", "30. Have you or will you receive income during this calendar year as a one-time only payment?", YES_NO_1_2),
  item("oneTimeIncome.thisYearItems", 0, "type", "If Yes  Type", "text"),
  item("oneTimeIncome.thisYearItems", 0, "amount", "Amount", "money"),
  item("oneTimeIncome.thisYearItems", 0, "month", "Month Received", "number"),
  item("oneTimeIncome.thisYearItems", 0, "year", "Year received", "number"),
  // the template splits Q31's Yes and No into two single-widget fields (/1 and /2)
  answer(
    "oneTimeIncome.nextYear",
    "31. Will you receive income during the next calendar year as a one-time only payment?",
    { kind: "pick", states: { yes: "1" } },
  ),
  answer(
    "oneTimeIncome.nextYear",
    "32. Will you receive income during the next calendar year as a one-time only payment?",
    { kind: "pick", states: { no: "2" } },
  ),
  item("oneTimeIncome.nextYearItems", 0, "type", "If Yes  Type_2", "text"),
  item("oneTimeIncome.nextYearItems", 0, "amount", "Amount_2", "money"),
  item("oneTimeIncome.nextYearItems", 0, "month", "Month Received_2", "number"),
  item("oneTimeIncome.nextYearItems", 0, "year", "Year received_2", "number"),

  // Q32 deductions: a box ticked per amount given, then "None"; the end of the list is on form page 7 (index 8).
  // Eight of the amount fields are ONE field shared with Person 2's deductions page (see the Task 5 report).
  ...deduction("educator", "Educator expense Yearly amount", "ducator expense: Yearly amount $"),
  ...deduction(
    "reservistExpenses",
    "Certain business expenses of reservists performing artists or feebased government officials Yearly amount",
    "Certain business expenses of reservists, performing artists, or fee-based government officials: Yearly amount $",
  ),
  ...deduction("hsa", "Health Savings Account deduction Yearly amount", "Health Savings Account deduction: Yearly amount $"),
  ...deduction(
    "movingExpenses",
    "Moving expenses for members of the Armed Forces Yearly amount",
    "Moving expenses for members of the Armed Forces: Yearly amount $",
  ),
  ...deduction("selfEmploymentTax", "Deductible part of selfemployment tax Yearly amount", "Deductible part of self-employment tax: Yearly amount $"),
  ...deduction(
    "selfEmployedRetirement",
    "Contribution to selfemployed SEP SIMPLE and qualified plans Yearly amount",
    "Contribution to self-employed SEP, SIMPLE, and qualified plans: Yearly amount $",
  ),
  ...deduction(
    "selfEmployedHealthInsurance",
    "Selfemployed health insurance deduction Yearly amount",
    "Self-employed health insurance deduction: Yearly amount $",
  ),
  ...deduction(
    "earlyWithdrawalPenalty",
    "Penalty on early withdrawal of savings Yearly amount",
    "Penalty on early withdrawal of savings: Yearly amount $",
  ),
  ...deduction(
    "alimonyPaid",
    "Alimony paid alimony payments for a divorce separation agreement or court order that was finalized before January 1 2019",
    "Alimony paid $",
  ),
  ...deduction("ira", "Individual Retirement Account IRA deduction Yearly amount", "Individual Retirement Account (IRA) deduction: Yearly amount $"),
  ...deduction(
    "studentLoanInterest",
    "Student loan deduction interest only not total payment Yearly amount",
    "Student loan deduction (interest only, not total payment): Yearly amount $",
  ),
  answer("deductions.none", "None", CHECK),

  // Q33 and Q34 yearly income
  answer("expectedIncomeThisYear", "33. What is your total expected income for the current calendar year?", "money"),
  answer("expectedIncomeNextYear", "34. What is your total expected income for next calendar year, if different?", "money"),
]

/** One "check / $ amount / How often?" line of Q28; the frequency is written as the form's own wording. */
function otherIncomeLine(kind: string, checkbox: string, amount: string, howOften: string): PersonRow[] {
  return [
    derived(`income.${kind}.checked`, checkbox, CHECK),
    derived(`income.${kind}.amount`, amount, "money"),
    derived(`income.${kind}.frequencyText`, howOften, "text"),
  ]
}

/** One rental unit line of Q29b; the amount goes into the Income or the Loss blank by the unit's `isLoss`. */
function rentalUnit(index: number, address: string, unit: string, income: string, loss: string, owner: string): PersonRow[] {
  return [
    item("rental.units", index, "address", address, "text"),
    item("rental.units", index, "unit", unit, "text"),
    derived(`rental.unit.${index}.income`, income, "money"),
    derived(`rental.unit.${index}.loss`, loss, "money"),
    item("rental.units", index, "ownerOccupied", owner, YES_NO_1_2),
  ]
}

/** One deduction of Q32: its box is ticked when a yearly amount is given. */
function deduction(key: string, checkbox: string, amount: string): PersonRow[] {
  return [
    derived(`deductions.${key}.checked`, checkbox, CHECK),
    answer(`deductions.amounts.${key}`, amount, "money"),
  ]
}
