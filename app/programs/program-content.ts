/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Static content for the public, server-rendered program landing pages
 * (/programs/[slug]). These pages exist for SEO: each one targets the
 * searches Massachusetts residents actually make ("MassHealth income
 * limits 2026", "am I eligible for SNAP in MA") and funnels visitors
 * into the prescreener.
 *
 * Dollar figures mirror the live eligibility engine — when
 * lib/benefit-orchestration/programs/* or lib/masshealth/constants.ts
 * change for a new program year, update the numbers here too.
 */

export interface ProgramFaq {
  question: string
  answer: string
}

export interface IncomeLimitRow {
  householdSize: string
  limit: string
}

export interface ProgramContent {
  slug: string
  /** Short name used in nav/cards. */
  name: string
  /** <title> without the "| HealthCompass MA" suffix (layout template adds it). */
  metaTitle: string
  metaDescription: string
  h1: string
  intro: string
  /** What the program gives you. */
  benefitSummary: string[]
  /** Income limit table, if the program has a clean table. */
  incomeLimits?: {
    caption: string
    columnLabel: string
    rows: IncomeLimitRow[]
    footnote?: string
  }
  /** Who qualifies, beyond income. */
  eligibilityPoints: string[]
  howToApply: string[]
  faqs: ProgramFaq[]
  officialLinks: { label: string; url: string }[]
}

export const PROGRAM_PAGES: ProgramContent[] = [
  {
    slug: "masshealth",
    name: "MassHealth",
    metaTitle: "MassHealth Eligibility 2026: Income Limits & How to Apply",
    metaDescription:
      "Check 2026 MassHealth income limits for adults, children, and pregnant women in Massachusetts. Free eligibility check in minutes — apply online with step-by-step help in 6 languages.",
    h1: "MassHealth Eligibility 2026: Who Qualifies and How to Apply",
    intro:
      "MassHealth is Massachusetts' Medicaid and CHIP program. It provides free or low-cost health coverage to more than 2 million residents — adults, children, seniors, pregnant women, and people with disabilities. Eligibility is based mainly on your household income as a percentage of the Federal Poverty Level (FPL), and the limits are higher than many people expect.",
    benefitSummary: [
      "Doctor visits, hospital care, and emergency services",
      "Prescription drug coverage",
      "Behavioral health and substance use treatment",
      "Dental and vision care (varies by plan type)",
      "Long-term services and supports for seniors and people with disabilities",
    ],
    incomeLimits: {
      caption: "2026 MassHealth CarePlus income limits (adults 21–64, 138% FPL)",
      columnLabel: "Annual income limit",
      rows: [
        { householdSize: "1", limit: "$22,025" },
        { householdSize: "2", limit: "$29,863" },
        { householdSize: "3", limit: "$37,702" },
        { householdSize: "4", limit: "$45,540" },
      ],
      footnote:
        "Children qualify for MassHealth Standard up to 150% FPL, pregnant women up to 200% FPL, and families may qualify for Family Assistance up to 300% FPL. Above these limits, ConnectorCare and premium tax credits are available up to 500% FPL.",
    },
    eligibilityPoints: [
      "Massachusetts resident",
      "U.S. citizen or qualified immigrant (undocumented residents may qualify for MassHealth Limited emergency coverage)",
      "Adults 21–64: income up to 138% FPL (MassHealth CarePlus)",
      "Children under 19: income up to 150% FPL (MassHealth Standard)",
      "Pregnant women: income up to 200% FPL",
      "Adults with a documented disability: income up to 133% FPL with no asset test under MAGI rules",
    ],
    howToApply: [
      "Check your eligibility with our free 5-minute prescreener — no account needed",
      "Gather documents: photo ID, proof of MA residency, Social Security number, recent pay stubs, and your latest tax return",
      "Apply online through HealthCompass with guided, step-by-step help, or call MassHealth at 1-800-841-2900",
      "MassHealth processes most applications within 45 days (10 days if you have an urgent medical need)",
    ],
    faqs: [
      {
        question: "What is the income limit for MassHealth in 2026?",
        answer:
          "For most adults aged 21–64, the 2026 limit is 138% of the Federal Poverty Level — about $22,025 a year for a single person or $45,540 for a family of four. Children qualify up to 150% FPL and pregnant women up to 200% FPL, so a family can earn more and still get coverage for kids.",
      },
      {
        question: "Can I get MassHealth if I'm not a U.S. citizen?",
        answer:
          "Qualified immigrants (green card holders, refugees, asylees, and others) can get full MassHealth coverage. Undocumented residents may qualify for MassHealth Limited, which covers emergency and essential services including labor and delivery.",
      },
      {
        question: "How long does a MassHealth application take?",
        answer:
          "MassHealth must make a decision within 45 days of receiving a complete application, or within 10 days if you attest to an urgent medical need. Applying with complete documents — pay stubs, ID, proof of residency — avoids delays.",
      },
      {
        question: "What if my income is too high for MassHealth?",
        answer:
          "If your income is above the MassHealth limit but under 500% FPL, you likely qualify for ConnectorCare plans or premium tax credits through the Massachusetts Health Connector. Our prescreener checks both in one pass.",
      },
    ],
    officialLinks: [
      { label: "MassHealth official site (mass.gov)", url: "https://www.mass.gov/topics/masshealth" },
      { label: "Massachusetts Health Connector", url: "https://www.mahealthconnector.org/" },
    ],
  },
  {
    slug: "snap",
    name: "SNAP (Food Stamps)",
    metaTitle: "SNAP Benefits in Massachusetts 2026: Eligibility & How to Apply",
    metaDescription:
      "Am I eligible for SNAP in MA? Check 2026 Massachusetts SNAP income limits and benefit amounts — up to $975/month for a family of 4. Free eligibility check, apply in ~15 minutes.",
    h1: "SNAP Benefits in Massachusetts: 2026 Eligibility and Benefit Amounts",
    intro:
      "SNAP (the Supplemental Nutrition Assistance Program, formerly food stamps) helps Massachusetts households buy groceries with a monthly benefit on an EBT card. An estimated 700,000 Massachusetts residents are likely eligible for SNAP but not enrolled — many simply don't realize they qualify. SNAP is administered in MA by the Department of Transitional Assistance (DTA).",
    benefitSummary: [
      "Up to $292/month for a 1-person household (FY2026)",
      "Up to $536/month for 2 people, $768 for 3, and $975 for a family of 4",
      "Benefits load monthly onto an EBT card accepted at grocery stores, farmers markets, and many online retailers",
      "SNAP recipients are often automatically eligible for other help — school meals, discounted utilities, and the Healthy Incentives Program (HIP) for fresh produce",
    ],
    incomeLimits: {
      caption: "2026 SNAP gross monthly income limits in Massachusetts (130% FPL)",
      columnLabel: "Gross monthly income limit",
      rows: [
        { householdSize: "1", limit: "$1,729" },
        { householdSize: "2", limit: "$2,344" },
        { householdSize: "3", limit: "$2,960" },
        { householdSize: "4", limit: "$3,575" },
      ],
      footnote:
        "Net income (after deductions for housing, child care, and earned income) must be at or below 100% FPL. Households with a member who is 60+ or disabled face no gross income test.",
    },
    eligibilityPoints: [
      "Massachusetts resident",
      "Gross household income at or below 130% FPL (no gross test if a member is 60+ or disabled)",
      "Assets under $2,750 — or $4,250 if a member is elderly or disabled (many households are exempt)",
      "U.S. citizens and many qualified immigrants; children of immigrants often qualify even when parents don't",
    ],
    howToApply: [
      "Check your estimated benefit with our free prescreener — it takes about 5 minutes",
      "Gather: photo ID, proof of MA residency, proof of income, and housing costs (rent or mortgage)",
      "Apply through DTA Connect online, by phone at 1-877-382-2363, or with guided help from a HealthCompass social worker",
      "Most applications are decided within 30 days; expedited SNAP is available within 7 days for very low-income households",
    ],
    faqs: [
      {
        question: "How much SNAP will I get in Massachusetts?",
        answer:
          "The FY2026 maximum monthly benefit is $292 for one person, $536 for two, $768 for three, and $975 for a family of four — plus $220 for each additional person beyond eight. Your actual amount depends on your net income after deductions; lower income means a higher benefit.",
      },
      {
        question: "What is the SNAP income limit in MA for 2026?",
        answer:
          "Gross monthly income must generally be at or below 130% of the Federal Poverty Level — $1,729 for one person or $3,575 for a family of four. Households with an elderly (60+) or disabled member skip the gross income test entirely.",
      },
      {
        question: "Can I get SNAP if I'm on MassHealth?",
        answer:
          "Yes — and you likely already qualify. Massachusetts' \"SNAP Gap\" refers to roughly 700,000 MassHealth members who are likely SNAP-eligible but not enrolled. If you receive MassHealth, checking your SNAP eligibility takes minutes.",
      },
      {
        question: "Does applying for SNAP affect my immigration status?",
        answer:
          "Receiving SNAP for yourself or your children does not make you a public charge under current federal policy. Many qualified immigrants are eligible, and U.S.-citizen children qualify regardless of their parents' status.",
      },
    ],
    officialLinks: [
      { label: "DTA SNAP page (mass.gov)", url: "https://www.mass.gov/snap-benefits-formerly-food-stamps" },
      { label: "DTA Connect", url: "https://dtaconnect.eohhs.mass.gov/" },
    ],
  },
  {
    slug: "liheap",
    name: "LIHEAP (Fuel Assistance)",
    metaTitle: "LIHEAP Fuel Assistance in Massachusetts 2026: Income Limits & How to Apply",
    metaDescription:
      "Massachusetts fuel assistance (LIHEAP) pays $200–$2,400+ toward winter heating bills. Households earning up to 60% of state median income qualify — check eligibility free in minutes.",
    h1: "Massachusetts Fuel Assistance (LIHEAP): 2026 Income Limits and How to Apply",
    intro:
      "LIHEAP — the Low Income Home Energy Assistance Program, known in Massachusetts as Fuel Assistance — helps households pay winter heating bills between November and April. It covers oil, gas, electric, propane, and other heating sources, whether you pay a utility directly or heat is included in your rent. Because the limit is based on state median income rather than the poverty level, many working families qualify without realizing it.",
    benefitSummary: [
      "$200 to $2,400+ per heating season, paid toward your heating bill",
      "Covers all heat sources: oil, natural gas, electricity, propane, kerosene, and wood",
      "Renters qualify too — including when heat is included in rent",
      "Recipients often also qualify for utility discount rates, weatherization, and free heating system repairs",
    ],
    incomeLimits: {
      caption: "2026 Massachusetts LIHEAP income limits (60% of state median income)",
      columnLabel: "Annual income limit",
      rows: [
        { householdSize: "1", limit: "$47,174" },
        { householdSize: "2", limit: "$55,109" },
        { householdSize: "3", limit: "$64,224" },
        { householdSize: "4", limit: "$73,339" },
      ],
    },
    eligibilityPoints: [
      "Massachusetts resident responsible for heating costs (directly or as part of rent)",
      "Household income at or below 60% of the state median income — about $73,000 for a family of four",
      "Homeowners and renters both qualify",
      "Households with seniors, people with disabilities, or children under 6 receive priority",
    ],
    howToApply: [
      "Check your eligibility with our free prescreener",
      "Gather: photo ID, proof of address, proof of income for all household members, and a recent heating bill (or lease showing heat included)",
      "Apply through your local Community Action Agency — applications open November 1 each year",
      "Benefits are paid directly to your utility or fuel vendor",
    ],
    faqs: [
      {
        question: "What is the income limit for fuel assistance in Massachusetts?",
        answer:
          "For the 2025–2026 heating season, household income must be at or below 60% of the state median income — about $47,174 for a single person and $73,339 for a family of four. That is well above the poverty line, so many working households qualify.",
      },
      {
        question: "How much does LIHEAP pay in Massachusetts?",
        answer:
          "Benefits range from roughly $200 to $2,400+ per heating season depending on your income, household size, and heating type. Priority households — those with seniors, young children, or members with disabilities — may receive larger benefits.",
      },
      {
        question: "Can renters get fuel assistance?",
        answer:
          "Yes. Renters qualify whether they pay heating bills directly or have heat included in their rent. If heat is included, the benefit is calculated based on a portion of your rent.",
      },
      {
        question: "When can I apply for Massachusetts fuel assistance?",
        answer:
          "Applications open November 1 and the heating season runs through April 30. You can apply any time during the season, but earlier is better — benefits help with bills from November onward.",
      },
    ],
    officialLinks: [
      { label: "MA Fuel Assistance (mass.gov)", url: "https://www.mass.gov/fuel-assistance" },
    ],
  },
  {
    slug: "wic",
    name: "WIC",
    metaTitle: "WIC in Massachusetts 2026: Eligibility, Income Limits & How to Apply",
    metaDescription:
      "WIC provides healthy food, nutrition support, and breastfeeding help for pregnant women and children under 5 in Massachusetts. Income up to 185% FPL qualifies — and MassHealth or SNAP enrollment qualifies you automatically.",
    h1: "WIC in Massachusetts: 2026 Eligibility and How to Apply",
    intro:
      "WIC (Women, Infants, and Children) provides healthy foods, nutrition counseling, breastfeeding support, and healthcare referrals to pregnant and postpartum women, infants, and children under age 5. If you or your children are on MassHealth, SNAP, or TAFDC, you already meet the income requirement automatically.",
    benefitSummary: [
      "Monthly food benefits for fruits, vegetables, milk, eggs, whole grains, and infant formula",
      "Nutrition counseling and breastfeeding support from certified specialists",
      "Referrals to healthcare, immunizations, and other services",
      "Benefits load onto a WIC card usable at most Massachusetts grocery stores",
    ],
    incomeLimits: {
      caption: "2026 Massachusetts WIC income limits (185% FPL)",
      columnLabel: "Annual income limit",
      rows: [
        { householdSize: "1", limit: "$29,526" },
        { householdSize: "2", limit: "$40,034" },
        { householdSize: "3", limit: "$50,542" },
        { householdSize: "4", limit: "$61,050" },
      ],
      footnote:
        "A pregnant woman counts as two household members for WIC. Enrollment in MassHealth, SNAP, or TAFDC automatically satisfies the income requirement.",
    },
    eligibilityPoints: [
      "Massachusetts resident — no citizenship or immigration requirement",
      "Pregnant or postpartum women (up to 6 months after birth, 12 if breastfeeding), infants, and children under 5",
      "Household income at or below 185% FPL, or enrolled in MassHealth, SNAP, or TAFDC",
      "A nutrition assessment at a local WIC office completes enrollment",
    ],
    howToApply: [
      "Check your eligibility with our free prescreener",
      "Find your local WIC office — there are more than 30 across Massachusetts",
      "Bring: proof of identity, MA residency, income (or MassHealth/SNAP card), and your child's immunization record if available",
      "Most families complete enrollment in a single visit and receive benefits the same day",
    ],
    faqs: [
      {
        question: "Who qualifies for WIC in Massachusetts?",
        answer:
          "Pregnant and postpartum women, infants, and children under age 5 in households earning up to 185% of the Federal Poverty Level — about $61,050 a year for a family of four in 2026. Anyone enrolled in MassHealth, SNAP, or TAFDC automatically meets the income test.",
      },
      {
        question: "Does immigration status affect WIC eligibility?",
        answer:
          "No. WIC has no citizenship or immigration status requirement, and using WIC does not affect public charge determinations. Massachusetts residency is all that's required.",
      },
      {
        question: "Can I get WIC and SNAP at the same time?",
        answer:
          "Yes — they stack. Many families receive both, and being on SNAP automatically satisfies WIC's income requirement. Our prescreener checks both programs (and several others) in one pass.",
      },
    ],
    officialLinks: [
      { label: "Massachusetts WIC (mass.gov)", url: "https://www.mass.gov/wic-nutrition-program" },
    ],
  },
  {
    slug: "eitc",
    name: "EITC",
    metaTitle: "Earned Income Tax Credit (EITC) in Massachusetts 2026: Do You Qualify?",
    metaDescription:
      "Working families in Massachusetts can claim up to $8,046 in federal EITC plus a 40% state match — over $11,000 combined for families with 3+ children. Check if you qualify free.",
    h1: "Earned Income Tax Credit in Massachusetts: 2026 Amounts and Eligibility",
    intro:
      "The Earned Income Tax Credit (EITC) is a refundable tax credit for working people with low to moderate income — meaning you get the money even if you owe no tax. Massachusetts adds a state EITC worth 40% of the federal credit, one of the most generous state matches in the country. One in five eligible workers never claims it.",
    benefitSummary: [
      "Federal credit up to $8,046 for families with 3 or more children (2026)",
      "Up to $7,152 with 2 children, $4,328 with 1 child, and $649 with no children",
      "Massachusetts adds 40% of your federal credit on your state return — up to $3,218 more",
      "Fully refundable: you receive the credit as a refund even if you owe no taxes",
    ],
    eligibilityPoints: [
      "Earned income from a job or self-employment during the tax year",
      "2026 income under $59,899 (single, 3+ children) up to $66,819 (married filing jointly, 3+ children)",
      "Workers without children qualify with income under $18,591 (single) or $25,511 (married)",
      "Valid Social Security number and a federal tax return — even if your income is below the filing requirement",
    ],
    howToApply: [
      "Check your estimated credit with our free prescreener",
      "File your federal tax return (Form 1040) and claim the EITC — free filing help is available through VITA sites across Massachusetts",
      "Claim the Massachusetts EITC (40% of federal) on your MA Form 1",
      "If you missed past years, you can still amend returns up to 3 years back and claim refunds",
    ],
    faqs: [
      {
        question: "How much is the EITC in Massachusetts?",
        answer:
          "Combined federal and state, a Massachusetts family with three or more children can receive over $11,200 — up to $8,046 federal plus a 40% state match of up to $3,218. Smaller families and workers without children receive smaller but still meaningful credits.",
      },
      {
        question: "Do I have to owe taxes to get the EITC?",
        answer:
          "No. The EITC is fully refundable — if the credit exceeds what you owe, the IRS and Massachusetts DOR pay you the difference as a refund. But you must file a tax return to claim it, even if your income is below the filing threshold.",
      },
      {
        question: "Can I claim the EITC for past years I missed?",
        answer:
          "Yes. You can file or amend returns for up to three prior tax years and claim the credit retroactively. Free help is available at VITA (Volunteer Income Tax Assistance) sites throughout Massachusetts.",
      },
    ],
    officialLinks: [
      { label: "IRS EITC information", url: "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc" },
      { label: "Massachusetts EITC (mass.gov)", url: "https://www.mass.gov/info-details/earned-income-tax-credit-eitc" },
    ],
  },
]

export function getProgramBySlug(slug: string): ProgramContent | undefined {
  return PROGRAM_PAGES.find((p) => p.slug === slug)
}
