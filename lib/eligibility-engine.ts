// MassHealth Conversational Eligibility Pre-screener
// Rule Engine based on 2026 Federal Poverty Level Guidelines & MassHealth Regulations

// 2026 Federal Poverty Level Guidelines (48 contiguous states + DC)
// Source: HHS 2026 Poverty Guidelines
const FPL_2026_BASE = 15060  // 1 person
const FPL_2026_PER_ADDITIONAL = 5380  // each additional person

export function getAnnualFPL(householdSize: number): number {
  const size = Math.max(1, householdSize)
  return FPL_2026_BASE + (size - 1) * FPL_2026_PER_ADDITIONAL
}

export function getMonthlyFPL(householdSize: number): number {
  return Math.round(getAnnualFPL(householdSize) / 12)
}

export function getIncomeAsFPLPercent(annualIncome: number, householdSize: number): number {
  const fpl = getAnnualFPL(householdSize)
  return Math.round((annualIncome / fpl) * 100)
}

// Key FPL thresholds for MassHealth programs (2026)
// MassHealth CarePlus (ACA Medicaid expansion): 133% + 5% income disregard = 138%
// MassHealth Standard for children: 150% FPL
// MassHealth Standard for pregnant women: 200% FPL
// MassHealth Standard for seniors/disabled: 100-133% FPL
// ConnectorCare: 139–300% FPL
// Federal premium tax credits (ACA): up to 400% FPL (no cap post-ARP if extended)

export type CitizenshipStatus =
  | 'citizen'
  | 'qualified_immigrant'
  | 'undocumented'
  | 'other'

export interface ScreenerData {
  livesInMA: boolean
  age: number
  isPregnant: boolean
  hasDisability: boolean     // documented disability or SSI/SSDI recipient
  hasMedicare: boolean
  householdSize: number
  annualIncome: number
  citizenshipStatus: CitizenshipStatus
  hasEmployerInsurance: boolean
}

export type EligibilityStatus = 'likely' | 'possibly' | 'unlikely'
export type EligibilityColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray'

export interface EligibilityResult {
  program: string
  status: EligibilityStatus
  tagline: string
  details: string
  actionLabel: string
  actionHref: string
  color: EligibilityColor
  priority: number
}

export interface EligibilityReport {
  fplPercent: number
  annualFPL: number
  monthlyFPL: number
  results: EligibilityResult[]
  summary: string
}

// ─── Rule Engine ────────────────────────────────────────────────────────────

export function runEligibilityCheck(data: ScreenerData): EligibilityReport {
  const fplPct = getIncomeAsFPLPercent(data.annualIncome, data.householdSize)
  const annualFPL = getAnnualFPL(data.householdSize)
  const monthlyFPL = getMonthlyFPL(data.householdSize)
  const results: EligibilityResult[] = []

  const isQualifiedImmigrant =
    data.citizenshipStatus === 'citizen' ||
    data.citizenshipStatus === 'qualified_immigrant'

  // ── Non-MA Resident ──────────────────────────────────────────────────────
  if (!data.livesInMA) {
    return {
      fplPercent: fplPct,
      annualFPL,
      monthlyFPL,
      summary: 'MassHealth is only available to Massachusetts residents.',
      results: [
        {
          program: 'Not Eligible for MassHealth',
          status: 'unlikely',
          tagline: 'You must reside in Massachusetts to apply.',
          details:
            'MassHealth (Medicaid) is administered by the Commonwealth of Massachusetts and requires Massachusetts residency. Visit healthcare.gov to explore coverage options in your state.',
          actionLabel: 'Visit healthcare.gov',
          actionHref: 'https://www.healthcare.gov',
          color: 'red',
          priority: 1,
        },
      ],
    }
  }

  // ── Undocumented Status ──────────────────────────────────────────────────
  if (data.citizenshipStatus === 'undocumented') {
    results.push({
      program: 'MassHealth Limited',
      status: 'likely',
      tagline: 'Emergency and pregnancy services regardless of immigration status.',
      details:
        'MassHealth Limited provides emergency medical care, labor and delivery, pregnancy-related services, and treatment for certain conditions (e.g., breast/cervical cancer, COVID-19). Immigration status is not a barrier for these services.',
      actionLabel: 'Apply for MassHealth',
      actionHref: '/application/new',
      color: 'yellow',
      priority: 1,
    })

    if (data.isPregnant) {
      results.push({
        program: 'MassHealth Standard – Pregnancy',
        status: 'likely',
        tagline: 'Full prenatal and delivery coverage available.',
        details:
          'Pregnant individuals may qualify for MassHealth Standard for the duration of pregnancy regardless of immigration status, covering full prenatal care, delivery, and 12 months postpartum.',
        actionLabel: 'Apply Now',
        actionHref: '/application/new',
        color: 'green',
        priority: 1,
      })
    }

    return { fplPercent: fplPct, annualFPL, monthlyFPL, results, summary: buildSummary(results) }
  }

  // ── PREGNANT (any qualified status, up to 200% FPL) ─────────────────────
  if (data.isPregnant && isQualifiedImmigrant && fplPct <= 200) {
    results.push({
      program: 'MassHealth Standard – Pregnancy',
      status: 'likely',
      tagline: `At ${fplPct}% FPL — full prenatal, delivery & 12-month postpartum coverage.`,
      details:
        'Pregnant individuals with household income up to 200% FPL qualify for full MassHealth Standard. Coverage includes prenatal care, OB/GYN visits, ultrasounds, hospital delivery, and 12 months of postpartum care. No premiums or copays.',
      actionLabel: 'Apply Now',
      actionHref: '/application/new',
      color: 'green',
      priority: 1,
    })
  }

  // ── CHILDREN UNDER 19 ────────────────────────────────────────────────────
  if (data.age < 19 && isQualifiedImmigrant) {
    if (fplPct <= 150) {
      results.push({
        program: 'MassHealth Standard',
        status: 'likely',
        tagline: `At ${fplPct}% FPL — full Medicaid coverage, $0 premiums.`,
        details:
          'Children under 19 with household income at or below 150% FPL qualify for full MassHealth Standard (Medicaid). Covers doctor visits, specialist care, dental, vision, mental health, prescriptions, and more — no monthly premiums or copays.',
        actionLabel: 'Apply Now',
        actionHref: '/application/new',
        color: 'green',
        priority: 1,
      })
    } else if (fplPct <= 300) {
      results.push({
        program: 'MassHealth Family Assistance (CHIP)',
        status: 'likely',
        tagline: `At ${fplPct}% FPL — low-cost children's coverage through CHIP.`,
        details:
          "Children under 19 with income between 150–300% FPL qualify for MassHealth Family Assistance, Massachusetts's Children's Health Insurance Program (CHIP). Comprehensive coverage with low monthly premiums based on income.",
        actionLabel: 'Apply Now',
        actionHref: '/application/new',
        color: 'green',
        priority: 2,
      })
    } else {
      results.push({
        program: 'Health Connector Plans',
        status: 'possibly',
        tagline: `At ${fplPct}% FPL — marketplace plans with potential tax credits.`,
        details:
          'Families above 300% FPL may qualify for federal premium tax credits through the MA Health Connector if household income is below 400% FPL. Plans are available at various coverage tiers.',
        actionLabel: 'Explore Plans',
        actionHref: 'https://www.mahealthconnector.org',
        color: 'yellow',
        priority: 3,
      })
    }
    return { fplPercent: fplPct, annualFPL, monthlyFPL, results, summary: buildSummary(results) }
  }

  // ── ADULTS 19–64 ─────────────────────────────────────────────────────────
  if (data.age >= 19 && data.age <= 64 && isQualifiedImmigrant) {

    // Adults with disability/SSI at ≤133% FPL → MassHealth Standard
    if (data.hasDisability && fplPct <= 133) {
      results.push({
        program: 'MassHealth Standard',
        status: 'likely',
        tagline: `Disability + income at ${fplPct}% FPL — full Medicaid coverage.`,
        details:
          'Adults with documented disabilities or who receive SSI/SSDI with income up to 133% FPL qualify for full MassHealth Standard. Covers all medical, behavioral health, and long-term care services.',
        actionLabel: 'Apply Now',
        actionHref: '/application/new',
        color: 'green',
        priority: 1,
      })
    }

    // MassHealth CarePlus — ACA Medicaid expansion for adults 19–64
    // 133% FPL + 5% income disregard = effectively 138%
    if (!data.hasMedicare && fplPct <= 138 && !results.some(r => r.program === 'MassHealth Standard')) {
      results.push({
        program: 'MassHealth CarePlus',
        status: 'likely',
        tagline: `At ${fplPct}% FPL — free Medicaid for adults, no premiums.`,
        details:
          `Adults 19–64 with income up to 138% FPL (~$${Math.round(annualFPL * 1.38).toLocaleString()}/yr for a household of ${data.householdSize}) qualify for MassHealth CarePlus. Comprehensive coverage including medical, dental, mental health, and substance use services. No monthly premiums.`,
        actionLabel: 'Apply Now',
        actionHref: '/application/new',
        color: 'green',
        priority: 1,
      })
    }

    // ConnectorCare — subsidized marketplace, 139–300% FPL
    if (!data.hasMedicare && fplPct > 138 && fplPct <= 300) {
      results.push({
        program: 'ConnectorCare',
        status: 'likely',
        tagline: `At ${fplPct}% FPL — subsidized plans through MA Health Connector.`,
        details:
          'ConnectorCare offers subsidized health plans for adults 19–64 with income between 139–300% FPL. Monthly premiums are capped as a percentage of your income, and copays are reduced. Plans include medical, mental health, and prescription coverage.',
        actionLabel: 'Shop Plans',
        actionHref: 'https://www.mahealthconnector.org',
        color: 'green',
        priority: 2,
      })
    }

    // Federal premium tax credits, 300–400% FPL (or higher if extended)
    if (!data.hasMedicare && fplPct > 300 && fplPct <= 500) {
      results.push({
        program: 'Health Connector with Federal Tax Credits',
        status: 'likely',
        tagline: `At ${fplPct}% FPL — federal premium subsidies may apply.`,
        details:
          'You may qualify for federal Advance Premium Tax Credits (APTCs) to lower your monthly health plan premium through the MA Health Connector. The subsidy amount depends on your income, household size, and plan chosen.',
        actionLabel: 'Check Plans',
        actionHref: 'https://www.mahealthconnector.org',
        color: 'yellow',
        priority: 3,
      })
    }

    // Above subsidy threshold
    if (!data.hasMedicare && fplPct > 500) {
      results.push({
        program: 'Health Connector or Employer Plans',
        status: 'possibly',
        tagline: `At ${fplPct}% FPL — unsubsidized marketplace or employer coverage.`,
        details:
          'At this income level, you may not qualify for income-based subsidies, but comprehensive coverage is still available through the MA Health Connector or your employer. Compare plans to find the best value.',
        actionLabel: 'Explore Plans',
        actionHref: 'https://www.mahealthconnector.org',
        color: 'blue',
        priority: 4,
      })
    }

    // Medicare + low income → Medicare Savings Program
    if (data.hasMedicare && fplPct <= 135) {
      results.push({
        program: 'Medicare Savings Program',
        status: 'likely',
        tagline: `Medicare + income at ${fplPct}% FPL — help paying Medicare costs.`,
        details:
          'The Medicare Savings Program (administered by MassHealth) can pay your Medicare Part B premium (~$185/month in 2026), Part A premium (if applicable), deductibles, and copays. Significant savings for low-income Medicare beneficiaries.',
        actionLabel: 'Apply via MassHealth',
        actionHref: '/application/new',
        color: 'green',
        priority: 1,
      })
    }

    // Employer insurance note
    if (data.hasEmployerInsurance && fplPct > 138) {
      results.push({
        program: 'Employer-Sponsored Insurance',
        status: 'likely',
        tagline: 'Your employer coverage may be the most affordable option.',
        details:
          "If your employer's plan meets ACA minimum value standards and is considered 'affordable' (costs ≤9.02% of household income in 2026), you generally cannot receive marketplace subsidies for a Connector plan. Enroll in your employer plan during open enrollment.",
        actionLabel: 'Review Employer Benefits',
        actionHref: '#',
        color: 'blue',
        priority: 2,
      })
    }
  }

  // ── SENIORS 65+ ──────────────────────────────────────────────────────────
  if (data.age >= 65 && isQualifiedImmigrant) {
    if (data.hasMedicare) {
      // Dual eligible: MassHealth Standard pays Medicare cost-sharing
      if (fplPct <= 100) {
        results.push({
          program: 'MassHealth Standard (Dual Eligible)',
          status: 'likely',
          tagline: `At ${fplPct}% FPL — MassHealth covers what Medicare doesn't.`,
          details:
            "Seniors 65+ with income at or below 100% FPL enrolled in Medicare may qualify as 'dual eligible' — MassHealth Standard acts as secondary payer, covering Medicare premiums, deductibles, copays, and services Medicare doesn't cover (dental, vision, long-term care).",
          actionLabel: 'Apply Now',
          actionHref: '/application/new',
          color: 'green',
          priority: 1,
        })
      }

      // Medicare Savings Program
      if (fplPct <= 135) {
        results.push({
          program: 'Medicare Savings Program',
          status: 'likely',
          tagline: `At ${fplPct}% FPL — MassHealth pays your Medicare premiums.`,
          details:
            'The Medicare Savings Program can pay your Medicare Part B premium (~$185/month in 2026), and depending on income level (QMB, SLMB, or QI), may also cover deductibles and copays. Apply through MassHealth.',
          actionLabel: 'Apply via MassHealth',
          actionHref: '/application/new',
          color: 'green',
          priority: 1,
        })
      }

      if (fplPct > 135) {
        results.push({
          program: 'Medicare Supplement (Medigap) Plans',
          status: 'possibly',
          tagline: `At ${fplPct}% FPL — explore Medigap to cover Medicare gaps.`,
          details:
            'With income above the Medicare Savings Program limit, consider a Medicare Supplement (Medigap) plan to cover out-of-pocket Medicare costs. You can also enroll in a Medicare Advantage plan through the Health Connector.',
          actionLabel: 'Compare Medicare Plans',
          actionHref: 'https://www.mahealthconnector.org',
          color: 'blue',
          priority: 2,
        })
      }
    } else {
      // 65+ without Medicare (uncommon)
      results.push({
        program: 'MassHealth Standard',
        status: 'possibly',
        tagline: 'Coverage while you gain Medicare eligibility.',
        details:
          'Seniors 65+ not yet enrolled in Medicare may qualify for MassHealth Standard based on income and other factors. Contact MassHealth directly to determine eligibility and apply.',
        actionLabel: 'Contact MassHealth',
        actionHref: '/application/new',
        color: 'yellow',
        priority: 2,
      })
    }
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  if (results.length === 0) {
    results.push({
      program: 'Full Application Recommended',
      status: 'possibly',
      tagline: 'A full application will determine your exact eligibility.',
      details:
        'Based on your responses, your eligibility is not immediately clear. A full MassHealth application will collect the detailed information needed to make an official determination. The process is free.',
      actionLabel: 'Start Application',
      actionHref: '/application/new',
      color: 'yellow',
      priority: 1,
    })
  }

  results.sort((a, b) => a.priority - b.priority)

  return { fplPercent: fplPct, annualFPL, monthlyFPL, results, summary: buildSummary(results) }
}

function buildSummary(results: EligibilityResult[]): string {
  const topResult = results[0]
  if (!topResult) return 'Please complete a full application for an official determination.'

  if (topResult.status === 'likely') {
    return `Based on your responses, you likely qualify for ${topResult.program}. This is a pre-screening estimate — a full application is needed for official enrollment.`
  }
  if (topResult.status === 'possibly') {
    return `Based on your responses, you may qualify for coverage. Complete a full application to get an official determination.`
  }
  return `Based on your responses, you may not qualify for MassHealth. You may have other coverage options available.`
}

// ─── FPL Reference Table ──────────────────────────────────────────────────

export const FPL_TABLE_2026 = [1, 2, 3, 4, 5, 6, 7, 8].map((size) => ({
  householdSize: size,
  annualFPL: getAnnualFPL(size),
  monthlyFPL: getMonthlyFPL(size),
  pct138: Math.round(getAnnualFPL(size) * 1.38),
  pct200: Math.round(getAnnualFPL(size) * 2.0),
  pct300: Math.round(getAnnualFPL(size) * 3.0),
  pct400: Math.round(getAnnualFPL(size) * 4.0),
}))
