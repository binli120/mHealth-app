/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export const GENDER_IDENTITY_KEYS = ["male", "female", "transMan", "transWoman", "nonbinary", "notListed", "dontKnow", "declined"] as const
export const GENDER_IDENTITY_LABELS: Record<GenderIdentityKey, string> = {
  male: "Male",
  female: "Female",
  transMan: "Transgender man/trans man",
  transWoman: "Transgender woman/trans woman",
  nonbinary: "Genderqueer / gender nonconforming / non-binary / neither exclusively male nor female",
  notListed: "Gender identity not listed (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}

export const SEXUAL_ORIENTATION_KEYS = ["straight", "gayOrLesbian", "bisexual", "queerPansexual", "notListed", "dontKnow", "declined"] as const
export const SEXUAL_ORIENTATION_LABELS: Record<SexualOrientationKey, string> = {
  straight: "Straight or heterosexual",
  gayOrLesbian: "Lesbian or gay",
  bisexual: "Bisexual",
  queerPansexual: "Queer, pansexual, or questioning",
  notListed: "Sexual orientation is not listed (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}

export const RACE_KEYS = ["americanIndianAlaskaNative", "asian", "black", "nativeHawaiianPacificIslander", "white", "notListed", "dontKnow", "declined"] as const
export const RACE_LABELS: Record<RaceKey, string> = {
  americanIndianAlaskaNative: "American Indian or Alaska Native",
  asian: "Asian",
  black: "Black or African American",
  nativeHawaiianPacificIslander: "Native Hawaiian or Other Pacific Islander",
  white: "White",
  notListed: "Race is not listed here (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}

export const ETHNICITY_KEYS = [
  "african", "africanAmerican", "american", "asianIndian", "brazilian", "cambodian", "capeVerdean", "caribbeanIslander",
  "centralAmerican", "chicano", "chinese", "colombian", "cuban", "dominican", "easternEuropean", "european",
  "filipino", "guamanianChamorro", "guatemalan", "haitian", "honduran", "japanese", "korean", "laotian",
  "mexican", "mexicanAmerican", "middleEasternNorthAfrican", "otherAsian", "portuguese", "puertoRican", "russian", "salvadoran",
  "samoan", "southAmerican", "vietnamese", "notListed", "dontKnow", "declined",
] as const
export const ETHNICITY_LABELS: Record<EthnicityKey, string> = {
  african: "African",
  africanAmerican: "African American",
  american: "American",
  asianIndian: "Asian Indian",
  brazilian: "Brazilian",
  cambodian: "Cambodian",
  capeVerdean: "Cape Verdean",
  caribbeanIslander: "Caribbean Islander",
  centralAmerican: "Central American",
  chicano: "Chicano/a",
  chinese: "Chinese",
  colombian: "Colombian",
  cuban: "Cuban",
  dominican: "Dominican",
  easternEuropean: "Eastern European",
  european: "European",
  filipino: "Filipino",
  guamanianChamorro: "Guamanian or Chamorro",
  guatemalan: "Guatemalan",
  haitian: "Haitian",
  honduran: "Honduran",
  japanese: "Japanese",
  korean: "Korean",
  laotian: "Laotian/Lao",
  mexican: "Mexican",
  mexicanAmerican: "Mexican American",
  middleEasternNorthAfrican: "Middle Eastern or North African",
  otherAsian: "Other Asian",
  portuguese: "Portuguese",
  puertoRican: "Puerto Rican",
  russian: "Russian",
  salvadoran: "Salvadoran",
  samoan: "Samoan",
  southAmerican: "South American",
  vietnamese: "Vietnamese",
  notListed: "Ethnicity is not listed (please specify)",
  dontKnow: "Don't know",
  declined: "Choose not to answer",
}

export const ACCOMMODATION_CONDITION_KEYS = ["lowVision", "blind", "deaf", "hardOfHearing", "developmentallyDisabled", "intellectuallyDisabled", "physicallyDisabled", "other"] as const
export const ACCOMMODATION_CONDITION_LABELS: Record<AccommodationConditionKey, string> = {
  lowVision: "Low vision",
  blind: "Blind",
  deaf: "Deaf",
  hardOfHearing: "Hard of hearing",
  developmentallyDisabled: "Developmentally disabled",
  intellectuallyDisabled: "Intellectually disabled",
  physicallyDisabled: "Physically disabled",
  other: "Other (please explain)",
}

export const ACCOMMODATION_KEYS = ["tty", "largePrint", "asl", "videoRelay", "cart", "braille", "assistiveListening", "electronicFormat", "other"] as const
export const ACCOMMODATION_LABELS: Record<AccommodationKey, string> = {
  tty: "Text telephone (TTY)",
  largePrint: "Large-print publications",
  asl: "American Sign Language interpreter",
  videoRelay: "Video Relay Service",
  cart: "Communication Access Real-time Translations (CART)",
  braille: "Publications in braille",
  assistiveListening: "Assistive listening device",
  electronicFormat: "Publications in electronic format",
  other: "Other (please explain)",
}

export const DEDUCTION_KEYS = [
  "educator", "reservistExpenses", "hsa", "movingExpenses", "selfEmploymentTax", "selfEmployedRetirement",
  "selfEmployedHealthInsurance", "earlyWithdrawalPenalty", "alimonyPaid", "ira", "studentLoanInterest",
] as const
export const DEDUCTION_LABELS: Record<DeductionKey, string> = {
  educator: "Educator expenses",
  reservistExpenses: "Certain business expenses of reservists, performing artists, or fee-based government officials",
  hsa: "Health Savings Account deduction",
  movingExpenses: "Moving expenses for members of the Armed Forces",
  selfEmploymentTax: "Deductible part of self-employment tax",
  selfEmployedRetirement: "Contribution to self-employed SEP, SIMPLE, and qualified plans",
  selfEmployedHealthInsurance: "Self-employed health insurance deduction",
  earlyWithdrawalPenalty: "Penalty on early withdrawal of savings",
  alimonyPaid: "Alimony paid from a divorce, separation agreement, or court order that was finalized before January 1, 2019",
  ira: "Individual Retirement Account (IRA) deduction",
  studentLoanInterest: "Student loan interest deduction (interest only, not total payment)",
}

export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const
export const MONTH_LABELS: Record<MonthKey, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
}

export type GenderIdentityKey = (typeof GENDER_IDENTITY_KEYS)[number]
export type SexualOrientationKey = (typeof SEXUAL_ORIENTATION_KEYS)[number]
export type RaceKey = (typeof RACE_KEYS)[number]
export type EthnicityKey = (typeof ETHNICITY_KEYS)[number]
export type AccommodationConditionKey = (typeof ACCOMMODATION_CONDITION_KEYS)[number]
export type AccommodationKey = (typeof ACCOMMODATION_KEYS)[number]
export type DeductionKey = (typeof DEDUCTION_KEYS)[number]
export type MonthKey = (typeof MONTH_KEYS)[number]

export function emptyChecks<K extends string>(keys: readonly K[]): Record<K, boolean> {
  return Object.fromEntries(keys.map((key) => [key, false])) as Record<K, boolean>
}

export function countChecked(map: Record<string, boolean>): number {
  return Object.values(map).filter(Boolean).length
}
