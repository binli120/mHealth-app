/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * 2026 MassHealth figures used to screen SACA-2 (seniors / long-term care).
 *
 * Sources (retrieved 2026-10-13):
 * - https://www.mass.gov/info-details/program-financial-guidelines-for-certain-masshealth-applicants-and-members
 *   (last updated Oct 1, 2026)
 * - "2026 MassHealth Income Standards and Federal Poverty Guidelines" (DG-FPL_2026-03,
 *   effective March 1, 2026)
 *
 * Changing these changes screening outcomes — update only from the sources above.
 */

export const SACA2_FIGURES_YEAR = 2026

export interface EffectiveValue<T> {
  /** ISO date (YYYY-MM-DD) the value takes effect. */
  effective: string
  value: T
}

export interface Money {
  monthly: number
  yearly: number
}

export interface FplRow {
  size: number
  massHealthStandard: Money
  fpl100: Money
  fpl133: Money
  fpl150: Money
  fpl200: Money
  fpl250: Money
  fpl300: Money
  fpl400: Money
}

export const SACA2_FIGURES = {
  assetLimit: { individual: 2000, marriedCoupleMember: 3000 },
  /** Federal benefit rate x 300% (special income limit), per month. */
  federalBenefitRate300Monthly: 2982,
  /** Personal needs allowance / institutional income standard, per month. */
  personalNeedsAllowance: 72.8,
  maxHomeEquity: 1_130_000,
  communitySpouseResource: { min: 32_532, max: 162_660 },
  mmmnaMax: 4066.5,
  mmmnaMin: [
    { effective: "2025-07-01", value: 2643.75 },
    { effective: "2026-07-01", value: 2705 },
  ] as const satisfies readonly EffectiveValue<number>[],
  standardShelterExpense: [
    { effective: "2025-07-01", value: 793.13 },
    { effective: "2026-07-01", value: 811.5 },
  ] as const satisfies readonly EffectiveValue<number>[],
  snapUtility: {
    heat: [
      { effective: "2025-10-01", value: 914 },
      { effective: "2026-10-01", value: 945 },
    ] as const satisfies readonly EffectiveValue<number>[],
    noHeat: [
      { effective: "2025-10-01", value: 557 },
      { effective: "2026-10-01", value: 575 },
    ] as const satisfies readonly EffectiveValue<number>[],
  },
  /** Average daily cost of nursing-facility services (transfer-penalty divisor). */
  nursingFacilityDailyCost: 450,
  medicarePartBPremiumMonthly: 202.9,
  lookBackMonths: 60,
} as const

const m = (monthly: number, yearly: number): Money => ({ monthly, yearly })

// Effective March 1, 2026. Columns: standard, 100, 133, 150, 200, 250, 300, 400.
const FPL_ROWS: readonly FplRow[] = [
  { size: 1, massHealthStandard: m(522, 6264), fpl100: m(1330, 15960), fpl133: m(1769, 21228), fpl150: m(1995, 23940), fpl200: m(2660, 31920), fpl250: m(3325, 39900), fpl300: m(3990, 47880), fpl400: m(5320, 63840) },
  { size: 2, massHealthStandard: m(650, 7800), fpl100: m(1804, 21648), fpl133: m(2399, 28788), fpl150: m(2705, 32460), fpl200: m(3607, 43284), fpl250: m(4509, 54108), fpl300: m(5410, 64920), fpl400: m(7214, 86568) },
  { size: 3, massHealthStandard: m(775, 9300), fpl100: m(2277, 27324), fpl133: m(3028, 36336), fpl150: m(3415, 40980), fpl200: m(4554, 54648), fpl250: m(5692, 68304), fpl300: m(6830, 81960), fpl400: m(9107, 109284) },
  { size: 4, massHealthStandard: m(891, 10692), fpl100: m(2750, 33000), fpl133: m(3658, 43896), fpl150: m(4125, 49500), fpl200: m(5500, 66000), fpl250: m(6875, 82500), fpl300: m(8250, 99000), fpl400: m(11000, 132000) },
  { size: 5, massHealthStandard: m(1016, 12192), fpl100: m(3224, 38688), fpl133: m(4288, 51456), fpl150: m(4835, 58020), fpl200: m(6447, 77364), fpl250: m(8059, 96708), fpl300: m(9670, 116040), fpl400: m(12894, 154728) },
  { size: 6, massHealthStandard: m(1141, 13692), fpl100: m(3697, 44364), fpl133: m(4917, 59004), fpl150: m(5545, 66540), fpl200: m(7394, 88728), fpl250: m(9242, 110904), fpl300: m(11090, 133080), fpl400: m(14787, 177444) },
  { size: 7, massHealthStandard: m(1266, 15192), fpl100: m(4170, 50040), fpl133: m(5547, 66564), fpl150: m(6255, 75060), fpl200: m(8340, 100080), fpl250: m(10425, 125100), fpl300: m(12510, 150120), fpl400: m(16680, 200160) },
  { size: 8, massHealthStandard: m(1383, 16596), fpl100: m(4644, 55728), fpl133: m(6176, 74112), fpl150: m(6965, 83580), fpl200: m(9287, 111444), fpl250: m(11609, 139308), fpl300: m(13930, 167160), fpl400: m(18574, 222888) },
]

/** "For each additional person, add" row from the source table. */
const FPL_PER_ADDITIONAL_PERSON: Omit<FplRow, "size"> = {
  massHealthStandard: m(133, 1596),
  fpl100: m(474, 5688),
  fpl133: m(630, 7560),
  fpl150: m(710, 8520),
  fpl200: m(947, 11364),
  fpl250: m(1184, 14208),
  fpl300: m(1420, 17040),
  fpl400: m(1894, 22728),
}

const MONEY_KEYS = [
  "massHealthStandard",
  "fpl100",
  "fpl133",
  "fpl150",
  "fpl200",
  "fpl250",
  "fpl300",
  "fpl400",
] as const

export function getFplRow(familySize: number): FplRow {
  if (!Number.isInteger(familySize) || familySize < 1) {
    throw new Error(`Invalid family size: ${familySize}`)
  }
  if (familySize <= FPL_ROWS.length) {
    return FPL_ROWS[familySize - 1]
  }
  const extra = familySize - FPL_ROWS.length
  const base = FPL_ROWS[FPL_ROWS.length - 1]
  const row: FplRow = { ...base, size: familySize }
  for (const key of MONEY_KEYS) {
    row[key] = {
      monthly: base[key].monthly + extra * FPL_PER_ADDITIONAL_PERSON[key].monthly,
      yearly: base[key].yearly + extra * FPL_PER_ADDITIONAL_PERSON[key].yearly,
    }
  }
  return row
}

export function getEffectiveFigure<T>(entries: readonly EffectiveValue<T>[], on: Date): T {
  const day = on.toISOString().slice(0, 10)
  let chosen: EffectiveValue<T> | undefined
  for (const entry of entries) {
    if (entry.effective <= day && (!chosen || entry.effective > chosen.effective)) {
      chosen = entry
    }
  }
  if (!chosen) {
    throw new Error(`No figure effective on ${day}`)
  }
  return chosen.value
}
