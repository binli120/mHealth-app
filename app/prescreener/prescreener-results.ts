import {
  type EligibilityColor,
  type EligibilityReport,
  type EligibilityResult,
  type EligibilityResultCode,
  type ScreenerData,
} from "@/lib/eligibility-engine"
import { type SupportedLanguage } from "@/lib/i18n/languages"
import { formatPrescreenerCurrency, getPrescreenerCopy } from "./prescreener-copy"

interface ResultContext {
  annualFPL: number
  fplPercent: number
  householdSize: number
}

interface LocalizedResultFields {
  actionLabel: string
  details: string
  program: string
  tagline: string
}

type ResultFieldBuilder = (context: ResultContext) => LocalizedResultFields

const BADGE_LABELS: Record<SupportedLanguage, Record<EligibilityColor, string>> = {
  en: {
    green: "Likely Eligible",
    yellow: "Possibly Eligible",
    red: "Not Eligible",
    blue: "Option Available",
    gray: "See Details",
  },
  "zh-CN": {
    green: "很可能符合资格",
    yellow: "可能符合资格",
    red: "不符合资格",
    blue: "可选方案",
    gray: "查看详情",
  },
  ht: {
    green: "Sanble Elijib",
    yellow: "Ka Elijib",
    red: "Pa Elijib",
    blue: "Opsyon Disponib",
    gray: "Gade Detay",
  },
  "pt-BR": {
    green: "Provavelmente Elegível",
    yellow: "Possivelmente Elegível",
    red: "Não Elegível",
    blue: "Opção Disponível",
    gray: "Ver Detalhes",
  },
  es: {
    green: "Probablemente Elegible",
    yellow: "Posiblemente Elegible",
    red: "No Elegible",
    blue: "Opción Disponible",
    gray: "Ver Detalles",
  },
  vi: {
    green: "Có Khả Năng Đủ Điều Kiện",
    yellow: "Có Thể Đủ Điều Kiện",
    red: "Không Đủ Điều Kiện",
    blue: "Có Lựa Chọn",
    gray: "Xem Chi Tiết",
  },
}

const RESULT_COPY: Record<SupportedLanguage, Record<EligibilityResultCode, ResultFieldBuilder>> = {
  en: {
    not_eligible_non_ma: () => ({
      program: "Not Eligible for MassHealth",
      tagline: "You must live in Massachusetts to apply.",
      details: "MassHealth is administered by Massachusetts and requires state residency. Visit healthcare.gov to explore options where you live now.",
      actionLabel: "Visit healthcare.gov",
    }),
    masshealth_limited: () => ({
      program: "MassHealth Limited",
      tagline: "Emergency and pregnancy services are available regardless of immigration status.",
      details: "MassHealth Limited can cover emergency care, labor and delivery, pregnancy-related care, and treatment for certain qualifying conditions.",
      actionLabel: "Apply for MassHealth",
    }),
    pregnancy_undocumented_standard: () => ({
      program: "MassHealth Standard - Pregnancy",
      tagline: "Full prenatal, delivery, and postpartum coverage may be available.",
      details: "Pregnant applicants may qualify for full pregnancy coverage, including prenatal visits, delivery, and postpartum care, even without qualified immigration status.",
      actionLabel: "Apply Now",
    }),
    pregnancy_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard - Pregnancy",
      tagline: `At ${fplPercent}% FPL, full prenatal, delivery, and postpartum coverage may be available.`,
      details: "Pregnancy coverage can include prenatal visits, ultrasounds, hospital delivery, and postpartum care for up to 12 months.",
      actionLabel: "Apply Now",
    }),
    child_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `At ${fplPercent}% FPL, a child may qualify for full Medicaid coverage.`,
      details: "This can include primary care, specialists, dental, vision, behavioral health, prescriptions, and other core pediatric benefits.",
      actionLabel: "Apply Now",
    }),
    family_assistance_chip: ({ fplPercent }) => ({
      program: "MassHealth Family Assistance (CHIP)",
      tagline: `At ${fplPercent}% FPL, low-cost children's coverage may be available.`,
      details: "Family Assistance offers comprehensive children's coverage with premiums and cost-sharing that vary by income.",
      actionLabel: "Apply Now",
    }),
    health_connector_child_plans: ({ fplPercent }) => ({
      program: "Health Connector Plans",
      tagline: `At ${fplPercent}% FPL, marketplace plans with tax credits may be the next option.`,
      details: "Families above CHIP limits may still find subsidized coverage through the Massachusetts Health Connector.",
      actionLabel: "Explore Plans",
    }),
    adult_disability_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `With disability-related eligibility and income at ${fplPercent}% FPL, full Medicaid coverage may be available.`,
      details: "Adults with documented disabilities or SSI/SSDI may qualify for MassHealth Standard, including medical, behavioral health, and long-term services.",
      actionLabel: "Apply Now",
    }),
    careplus: ({ fplPercent, householdSize, annualFPL }) => ({
      program: "MassHealth CarePlus",
      tagline: `At ${fplPercent}% FPL, free Medicaid coverage for adults may be available.`,
      details: `Adults 19-64 may qualify up to 138% FPL, about ${formatPrescreenerCurrency(Math.round(annualFPL * 1.38), "en")} per year for a household of ${householdSize}.`,
      actionLabel: "Apply Now",
    }),
    connectorcare: ({ fplPercent }) => ({
      program: "ConnectorCare",
      tagline: `At ${fplPercent}% FPL, subsidized plans through the Massachusetts Health Connector may be available.`,
      details: "ConnectorCare can lower premiums and copays for adults who do not qualify for MassHealth but are still within income limits.",
      actionLabel: "Shop Plans",
    }),
    federal_tax_credits: ({ fplPercent }) => ({
      program: "Health Connector with Federal Tax Credits",
      tagline: `At ${fplPercent}% FPL, federal premium subsidies may help lower monthly costs.`,
      details: "Advance Premium Tax Credits can reduce the cost of marketplace coverage based on income, household size, and plan selection.",
      actionLabel: "Check Plans",
    }),
    employer_or_connector: ({ fplPercent }) => ({
      program: "Health Connector or Employer Plans",
      tagline: `At ${fplPercent}% FPL, unsubsidized marketplace or employer coverage may be the best fit.`,
      details: "If income is above subsidy ranges, compare employer-sponsored coverage with plans on the Massachusetts Health Connector.",
      actionLabel: "Explore Plans",
    }),
    medicare_savings_program_adult: ({ fplPercent }) => ({
      program: "Medicare Savings Program",
      tagline: `With Medicare and income at ${fplPercent}% FPL, MassHealth may help with Medicare costs.`,
      details: "This program can help pay Medicare Part B premiums and may also reduce deductibles and copays for lower-income beneficiaries.",
      actionLabel: "Apply via MassHealth",
    }),
    employer_sponsored_insurance: () => ({
      program: "Employer-Sponsored Insurance",
      tagline: "Employer coverage may be the most affordable option.",
      details: "If employer coverage meets affordability and minimum value rules, marketplace subsidies are often limited or unavailable.",
      actionLabel: "Review Employer Benefits",
    }),
    dual_eligible_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard (Dual Eligible)",
      tagline: `At ${fplPercent}% FPL, MassHealth may cover Medicare cost-sharing and additional benefits.`,
      details: "Dual eligibility can help cover Medicare premiums, deductibles, copays, and some services Medicare does not cover.",
      actionLabel: "Apply Now",
    }),
    medicare_savings_program_senior: ({ fplPercent }) => ({
      program: "Medicare Savings Program",
      tagline: `At ${fplPercent}% FPL, MassHealth may help pay Medicare premiums and cost-sharing.`,
      details: "Older adults within program limits may get help with Part B premiums and, depending on income, deductibles and copays.",
      actionLabel: "Apply via MassHealth",
    }),
    medigap_plans: ({ fplPercent }) => ({
      program: "Medicare Supplement (Medigap) Plans",
      tagline: `At ${fplPercent}% FPL, supplement coverage may help fill Medicare gaps.`,
      details: "If income is above Medicare Savings Program limits, compare Medigap and Medicare Advantage options for out-of-pocket protection.",
      actionLabel: "Compare Medicare Plans",
    }),
    senior_no_medicare_standard: () => ({
      program: "MassHealth Standard",
      tagline: "Coverage may be available while Medicare enrollment is pending or being sorted out.",
      details: "Older adults not yet enrolled in Medicare may still need a full eligibility review through MassHealth.",
      actionLabel: "Contact MassHealth",
    }),
    full_application_recommended: () => ({
      program: "Full Application Recommended",
      tagline: "A full application is the best way to confirm exact eligibility.",
      details: "Your answers suggest more detailed review is needed. A full application will collect the information required for an official decision.",
      actionLabel: "Start Application",
    }),
  },
  "zh-CN": {
    not_eligible_non_ma: () => ({
      program: "不符合 MassHealth 资格",
      tagline: "您必须居住在马萨诸塞州才能申请。",
      details: "MassHealth 由马萨诸塞州管理，要求申请人是本州居民。请访问 healthcare.gov 查看您当前所在州的选项。",
      actionLabel: "访问 healthcare.gov",
    }),
    masshealth_limited: () => ({
      program: "MassHealth Limited",
      tagline: "无论移民身份如何，都可能获得急诊和孕产服务。",
      details: "该项目可涵盖急诊护理、分娩、妊娠相关护理，以及某些符合条件的治疗。",
      actionLabel: "申请 MassHealth",
    }),
    pregnancy_undocumented_standard: () => ({
      program: "MassHealth Standard - 怀孕",
      tagline: "可能获得完整的产前、分娩和产后保障。",
      details: "怀孕申请人即使没有符合条件的移民身份，也可能获得完整的孕期相关保障。",
      actionLabel: "立即申请",
    }),
    pregnancy_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard - 怀孕",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，可能获得完整的孕产保障。`,
      details: "这类保障通常包括产检、超声检查、医院分娩以及最长 12 个月的产后护理。",
      actionLabel: "立即申请",
    }),
    child_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，儿童可能符合完整 Medicaid 保障。`,
      details: "通常包括基础医疗、专科、牙科、视力、行为健康、处方药等儿童核心福利。",
      actionLabel: "立即申请",
    }),
    family_assistance_chip: ({ fplPercent }) => ({
      program: "MassHealth Family Assistance (CHIP)",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，可能获得低成本儿童保险。`,
      details: "Family Assistance 为儿童提供综合保障，保费和自付费用随收入变化。",
      actionLabel: "立即申请",
    }),
    health_connector_child_plans: ({ fplPercent }) => ({
      program: "Health Connector 计划",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，带补贴的市场计划可能是下一步选择。`,
      details: "若收入高于 CHIP 限额，家庭仍可能通过 Massachusetts Health Connector 获得补贴计划。",
      actionLabel: "查看计划",
    }),
    adult_disability_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `若符合残障相关资格且收入为 FPL 的 ${fplPercent}% ，可能获得完整 Medicaid 保障。`,
      details: "有记录在案的残障人士或领取 SSI/SSDI 的成年人，可能符合包括医疗、行为健康和长期服务在内的保障。",
      actionLabel: "立即申请",
    }),
    careplus: ({ fplPercent, householdSize, annualFPL }) => ({
      program: "MassHealth CarePlus",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，成年人可能获得免费的 Medicaid 保障。`,
      details: `19 至 64 岁成年人最高可在 138% FPL 内符合资格，约合 ${formatPrescreenerCurrency(Math.round(annualFPL * 1.38), "zh-CN")} / 年（${householdSize} 人家庭）。`,
      actionLabel: "立即申请",
    }),
    connectorcare: ({ fplPercent }) => ({
      program: "ConnectorCare",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，可能获得补贴的 Health Connector 计划。`,
      details: "如果不符合 MassHealth 但收入仍在范围内，ConnectorCare 可以降低保费和共付额。",
      actionLabel: "浏览计划",
    }),
    federal_tax_credits: ({ fplPercent }) => ({
      program: "带联邦税收抵免的 Health Connector",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，联邦保费补贴可能降低月费。`,
      details: "预付保费税收抵免会根据收入、家庭人数和所选计划降低市场保险成本。",
      actionLabel: "查看计划",
    }),
    employer_or_connector: ({ fplPercent }) => ({
      program: "Health Connector 或雇主保险",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，无补贴市场计划或雇主保险可能更合适。`,
      details: "如果收入高于补贴范围，可比较雇主提供的保险与 Massachusetts Health Connector 计划。",
      actionLabel: "查看计划",
    }),
    medicare_savings_program_adult: ({ fplPercent }) => ({
      program: "Medicare Savings Program",
      tagline: `如果已有 Medicare 且收入为 FPL 的 ${fplPercent}% ，MassHealth 可能帮助支付 Medicare 费用。`,
      details: "该项目可帮助支付 Medicare Part B 保费，并可能减少免赔额和共付额。",
      actionLabel: "通过 MassHealth 申请",
    }),
    employer_sponsored_insurance: () => ({
      program: "雇主提供的保险",
      tagline: "雇主保险可能是最实惠的选择。",
      details: "如果雇主保险符合可负担性和最低价值标准，市场补贴通常会受限或无法获得。",
      actionLabel: "查看雇主福利",
    }),
    dual_eligible_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard（双重资格）",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，MassHealth 可能支付 Medicare 分摊费用和额外福利。`,
      details: "双重资格可帮助支付 Medicare 保费、免赔额、共付额，以及 Medicare 不涵盖的某些服务。",
      actionLabel: "立即申请",
    }),
    medicare_savings_program_senior: ({ fplPercent }) => ({
      program: "Medicare Savings Program",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，MassHealth 可能帮助支付 Medicare 保费和分摊费用。`,
      details: "符合收入条件的老年人可能获得 Part B 保费以及部分免赔额和共付额方面的帮助。",
      actionLabel: "通过 MassHealth 申请",
    }),
    medigap_plans: ({ fplPercent }) => ({
      program: "Medicare 补充计划（Medigap）",
      tagline: `收入为 FPL 的 ${fplPercent}% 时，补充保险可能帮助弥补 Medicare 缺口。`,
      details: "如果收入高于 Medicare Savings Program 限额，可比较 Medigap 与 Medicare Advantage 的自付保护。",
      actionLabel: "比较 Medicare 计划",
    }),
    senior_no_medicare_standard: () => ({
      program: "MassHealth Standard",
      tagline: "在 Medicare 资格办理期间，您仍可能获得保障。",
      details: "尚未加入 Medicare 的老年人，仍可能需要通过 MassHealth 进行完整资格审核。",
      actionLabel: "联系 MassHealth",
    }),
    full_application_recommended: () => ({
      program: "建议提交完整申请",
      tagline: "完整申请是确认准确资格的最佳方式。",
      details: "根据您的回答，仍需要更详细的审核。完整申请会收集正式决定所需的信息。",
      actionLabel: "开始申请",
    }),
  },
  ht: {
    not_eligible_non_ma: () => ({
      program: "Pa Elijib pou MassHealth",
      tagline: "Ou dwe rete Massachusetts pou aplike.",
      details: "MassHealth se Massachusetts ki administre li epi li mande rezidans nan eta a. Vizite healthcare.gov pou wè opsyon nan eta kote ou rete a.",
      actionLabel: "Vizite healthcare.gov",
    }),
    masshealth_limited: () => ({
      program: "MassHealth Limited",
      tagline: "Sèvis ijans ak sèvis pou gwosès ka disponib kèlkeswa estati imigrasyon.",
      details: "Pwogram sa a ka kouvri swen ijans, akouchman, swen ki gen rapò ak gwosès, ak kèk tretman ki kalifye.",
      actionLabel: "Aplike pou MassHealth",
    }),
    pregnancy_undocumented_standard: () => ({
      program: "MassHealth Standard - Gwosès",
      tagline: "Kouvèti konplè pou swen avan ak apre akouchman ka disponib.",
      details: "Moun ansent yo ka toujou kalifye pou kouvèti gwosès menm si yo pa gen estati imigrasyon ki kalifye.",
      actionLabel: "Aplike Kounye a",
    }),
    pregnancy_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard - Gwosès",
      tagline: `Nan ${fplPercent}% FPL, kouvèti konplè pou gwosès ka disponib.`,
      details: "Sa ka gen ladan vizit avan akouchman, ekografi, akouchman lopital, ak swen apre akouchman.",
      actionLabel: "Aplike Kounye a",
    }),
    child_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Nan ${fplPercent}% FPL, yon timoun ka kalifye pou kouvèti Medicaid konplè.`,
      details: "Sa ka gen ladan swen prensipal, espesyalis, dantè, vizyon, sante mantal, ak medikaman sou preskripsyon.",
      actionLabel: "Aplike Kounye a",
    }),
    family_assistance_chip: ({ fplPercent }) => ({
      program: "MassHealth Family Assistance (CHIP)",
      tagline: `Nan ${fplPercent}% FPL, asirans timoun ki pa chè ka disponib.`,
      details: "Family Assistance ofri kouvèti konplè pou timoun ak frè ki depann de revni an.",
      actionLabel: "Aplike Kounye a",
    }),
    health_connector_child_plans: ({ fplPercent }) => ({
      program: "Plan Health Connector",
      tagline: `Nan ${fplPercent}% FPL, plan mache ak kredi taks ka pwochen opsyon an.`,
      details: "Menm si revni an pi wo pase limit CHIP yo, fanmi yo ka toujou jwenn plan sibvansyone nan Massachusetts Health Connector.",
      actionLabel: "Eksplore Plan yo",
    }),
    adult_disability_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Avèk estati andikap ak revni nan ${fplPercent}% FPL, kouvèti Medicaid konplè ka disponib.`,
      details: "Adilt ki gen andikap dokimante oswa ki resevwa SSI/SSDI ka kalifye pou swen medikal, sante mantal, ak sèvis alontèm.",
      actionLabel: "Aplike Kounye a",
    }),
    careplus: ({ fplPercent, householdSize, annualFPL }) => ({
      program: "MassHealth CarePlus",
      tagline: `Nan ${fplPercent}% FPL, adilt yo ka jwenn kouvèti Medicaid gratis.`,
      details: `Adilt 19-64 an ka kalifye jiska 138% FPL, anviwon ${formatPrescreenerCurrency(Math.round(annualFPL * 1.38), "ht")} pa ane pou yon fwaye ${householdSize} moun.`,
      actionLabel: "Aplike Kounye a",
    }),
    connectorcare: ({ fplPercent }) => ({
      program: "ConnectorCare",
      tagline: `Nan ${fplPercent}% FPL, plan sibvansyone atravè Health Connector la ka disponib.`,
      details: "ConnectorCare ka diminye prim ak kopeman pou adilt ki pa kalifye pou MassHealth men ki toujou nan limit revni an.",
      actionLabel: "Achte Plan yo",
    }),
    federal_tax_credits: ({ fplPercent }) => ({
      program: "Health Connector ak Kredi Taks Federal",
      tagline: `Nan ${fplPercent}% FPL, sibvansyon federal ka bese pri chak mwa yo.`,
      details: "Advance Premium Tax Credits ka bese pri asirans nan mache a selon revni, kantite moun nan fwaye a, ak plan ou chwazi a.",
      actionLabel: "Tcheke Plan yo",
    }),
    employer_or_connector: ({ fplPercent }) => ({
      program: "Health Connector oswa Plan Anplwayè",
      tagline: `Nan ${fplPercent}% FPL, plan anplwayè oswa plan mache san sibvansyon ka pi bon opsyon an.`,
      details: "Si revni ou depase limit sibvansyon yo, konpare kouvèti anplwayè a ak plan Massachusetts Health Connector yo.",
      actionLabel: "Eksplore Plan yo",
    }),
    medicare_savings_program_adult: ({ fplPercent }) => ({
      program: "Pwogram Ekonomi Medicare",
      tagline: `Avèk Medicare ak revni nan ${fplPercent}% FPL, MassHealth ka ede peye depans Medicare yo.`,
      details: "Pwogram sa a ka ede peye prim Part B epi pafwa redwi dediktib ak kopeman.",
      actionLabel: "Aplike atravè MassHealth",
    }),
    employer_sponsored_insurance: () => ({
      program: "Asirans Anplwayè",
      tagline: "Kouvèti anplwayè a ka pi abòdab.",
      details: "Si plan anplwayè a satisfè règ sou pri ak valè minimòm, sibvansyon mache a souvan limite oswa pa disponib.",
      actionLabel: "Revize Benefis Anplwayè",
    }),
    dual_eligible_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard (Dual Eligible)",
      tagline: `Nan ${fplPercent}% FPL, MassHealth ka ede ak pri Medicare ak lòt benefis.`,
      details: "Elijiblite doub ka ede ak prim Medicare, dediktib, kopeman, ak kèk sèvis Medicare pa kouvri.",
      actionLabel: "Aplike Kounye a",
    }),
    medicare_savings_program_senior: ({ fplPercent }) => ({
      program: "Pwogram Ekonomi Medicare",
      tagline: `Nan ${fplPercent}% FPL, MassHealth ka ede peye prim Medicare ak lòt depans.`,
      details: "Gran moun ki anba limit pwogram nan ka jwenn asistans ak prim Part B ak kèk dediktib ak kopeman.",
      actionLabel: "Aplike atravè MassHealth",
    }),
    medigap_plans: ({ fplPercent }) => ({
      program: "Plan Siplemantè Medicare (Medigap)",
      tagline: `Nan ${fplPercent}% FPL, kouvèti siplemantè ka ede ak espas vid Medicare yo.`,
      details: "Si revni ou depase limit Medicare Savings Program nan, konpare Medigap ak Medicare Advantage pou pwoteksyon plis.",
      actionLabel: "Konpare Plan Medicare",
    }),
    senior_no_medicare_standard: () => ({
      program: "MassHealth Standard",
      tagline: "Kouvèti ka disponib pandan y ap rezoud enskripsyon Medicare.",
      details: "Gran moun ki poko enskri nan Medicare ka toujou bezwen yon revizyon elijiblite konplè atravè MassHealth.",
      actionLabel: "Kontakte MassHealth",
    }),
    full_application_recommended: () => ({
      program: "Aplikasyon Konplè Rekòmande",
      tagline: "Yon aplikasyon konplè se pi bon fason pou konfime elijiblite egzak ou.",
      details: "Repons ou yo montre yo bezwen plis enfòmasyon. Yon aplikasyon konplè ap rasanble detay ki nesesè pou desizyon ofisyèl la.",
      actionLabel: "Kòmanse Aplikasyon",
    }),
  },
  "pt-BR": {
    not_eligible_non_ma: () => ({
      program: "Não Elegível para MassHealth",
      tagline: "Você precisa morar em Massachusetts para se inscrever.",
      details: "O MassHealth é administrado por Massachusetts e exige residência no estado. Visite healthcare.gov para explorar opções onde você mora agora.",
      actionLabel: "Visitar healthcare.gov",
    }),
    masshealth_limited: () => ({
      program: "MassHealth Limited",
      tagline: "Serviços de emergência e gravidez podem estar disponíveis independentemente do status imigratório.",
      details: "Esse programa pode cobrir atendimento de emergência, parto, cuidados relacionados à gravidez e alguns tratamentos qualificados.",
      actionLabel: "Solicitar MassHealth",
    }),
    pregnancy_undocumented_standard: () => ({
      program: "MassHealth Standard - Gravidez",
      tagline: "Cobertura completa de pré-natal, parto e pós-parto pode estar disponível.",
      details: "Gestantes podem se qualificar para cobertura relacionada à gravidez mesmo sem status imigratório qualificado.",
      actionLabel: "Solicitar Agora",
    }),
    pregnancy_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard - Gravidez",
      tagline: `Com ${fplPercent}% do FPL, pode haver cobertura completa de gravidez.`,
      details: "A cobertura pode incluir consultas de pré-natal, ultrassons, parto hospitalar e cuidados pós-parto.",
      actionLabel: "Solicitar Agora",
    }),
    child_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Com ${fplPercent}% do FPL, uma criança pode se qualificar para cobertura completa do Medicaid.`,
      details: "Isso pode incluir atenção primária, especialistas, odontologia, visão, saúde comportamental e medicamentos.",
      actionLabel: "Solicitar Agora",
    }),
    family_assistance_chip: ({ fplPercent }) => ({
      program: "MassHealth Family Assistance (CHIP)",
      tagline: `Com ${fplPercent}% do FPL, pode haver cobertura infantil de baixo custo.`,
      details: "O Family Assistance oferece cobertura abrangente para crianças, com custos que variam conforme a renda.",
      actionLabel: "Solicitar Agora",
    }),
    health_connector_child_plans: ({ fplPercent }) => ({
      program: "Planos do Health Connector",
      tagline: `Com ${fplPercent}% do FPL, planos do mercado com créditos fiscais podem ser a próxima opção.`,
      details: "Famílias acima do limite do CHIP ainda podem encontrar cobertura subsidiada no Massachusetts Health Connector.",
      actionLabel: "Explorar Planos",
    }),
    adult_disability_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Com elegibilidade por deficiência e renda em ${fplPercent}% do FPL, pode haver cobertura completa do Medicaid.`,
      details: "Adultos com deficiência documentada ou que recebem SSI/SSDI podem se qualificar para cuidados médicos, saúde mental e serviços de longo prazo.",
      actionLabel: "Solicitar Agora",
    }),
    careplus: ({ fplPercent, householdSize, annualFPL }) => ({
      program: "MassHealth CarePlus",
      tagline: `Com ${fplPercent}% do FPL, pode haver Medicaid gratuito para adultos.`,
      details: `Adultos de 19 a 64 anos podem se qualificar até 138% do FPL, cerca de ${formatPrescreenerCurrency(Math.round(annualFPL * 1.38), "pt-BR")} por ano para uma família de ${householdSize} pessoas.`,
      actionLabel: "Solicitar Agora",
    }),
    connectorcare: ({ fplPercent }) => ({
      program: "ConnectorCare",
      tagline: `Com ${fplPercent}% do FPL, planos subsidiados pelo Massachusetts Health Connector podem estar disponíveis.`,
      details: "O ConnectorCare pode reduzir mensalidades e copagamentos para adultos que não se qualificam para o MassHealth, mas ainda estão dentro do limite de renda.",
      actionLabel: "Ver Planos",
    }),
    federal_tax_credits: ({ fplPercent }) => ({
      program: "Health Connector com Créditos Fiscais Federais",
      tagline: `Com ${fplPercent}% do FPL, subsídios federais podem reduzir o custo mensal.`,
      details: "Os créditos fiscais antecipados podem reduzir o custo do plano de mercado com base na renda, no tamanho da família e no plano escolhido.",
      actionLabel: "Ver Planos",
    }),
    employer_or_connector: ({ fplPercent }) => ({
      program: "Health Connector ou Planos do Empregador",
      tagline: `Com ${fplPercent}% do FPL, a melhor opção pode ser um plano sem subsídio ou o plano do empregador.`,
      details: "Se a renda estiver acima das faixas de subsídio, compare a cobertura do empregador com os planos do Massachusetts Health Connector.",
      actionLabel: "Explorar Planos",
    }),
    medicare_savings_program_adult: ({ fplPercent }) => ({
      program: "Medicare Savings Program",
      tagline: `Com Medicare e renda em ${fplPercent}% do FPL, o MassHealth pode ajudar com custos do Medicare.`,
      details: "Esse programa pode ajudar a pagar o prêmio da Parte B e também reduzir franquias e copagamentos.",
      actionLabel: "Solicitar pelo MassHealth",
    }),
    employer_sponsored_insurance: () => ({
      program: "Seguro Patrocinado pelo Empregador",
      tagline: "A cobertura do empregador pode ser a opção mais acessível.",
      details: "Se o plano do empregador atender às regras de valor mínimo e acessibilidade, os subsídios do mercado geralmente são limitados ou indisponíveis.",
      actionLabel: "Revisar Benefícios do Empregador",
    }),
    dual_eligible_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard (Elegibilidade Dupla)",
      tagline: `Com ${fplPercent}% do FPL, o MassHealth pode cobrir custos do Medicare e benefícios extras.`,
      details: "A elegibilidade dupla pode ajudar com prêmios do Medicare, franquias, copagamentos e alguns serviços não cobertos pelo Medicare.",
      actionLabel: "Solicitar Agora",
    }),
    medicare_savings_program_senior: ({ fplPercent }) => ({
      program: "Medicare Savings Program",
      tagline: `Com ${fplPercent}% do FPL, o MassHealth pode ajudar a pagar prêmios e custos compartilhados do Medicare.`,
      details: "Pessoas idosas dentro do limite do programa podem obter ajuda com o prêmio da Parte B e alguns copagamentos e franquias.",
      actionLabel: "Solicitar pelo MassHealth",
    }),
    medigap_plans: ({ fplPercent }) => ({
      program: "Planos Suplementares do Medicare (Medigap)",
      tagline: `Com ${fplPercent}% do FPL, a cobertura suplementar pode ajudar a preencher lacunas do Medicare.`,
      details: "Se a renda estiver acima do limite do Medicare Savings Program, compare Medigap e Medicare Advantage para reduzir custos próprios.",
      actionLabel: "Comparar Planos do Medicare",
    }),
    senior_no_medicare_standard: () => ({
      program: "MassHealth Standard",
      tagline: "Pode haver cobertura enquanto a inscrição no Medicare é resolvida.",
      details: "Pessoas idosas que ainda não estão inscritas no Medicare podem precisar de uma revisão completa de elegibilidade pelo MassHealth.",
      actionLabel: "Falar com o MassHealth",
    }),
    full_application_recommended: () => ({
      program: "Aplicação Completa Recomendada",
      tagline: "Uma aplicação completa é a melhor forma de confirmar a elegibilidade exata.",
      details: "Suas respostas indicam que é necessária uma análise mais detalhada. A aplicação completa reúne as informações para uma decisão oficial.",
      actionLabel: "Iniciar Aplicação",
    }),
  },
  es: {
    not_eligible_non_ma: () => ({
      program: "No Elegible para MassHealth",
      tagline: "Debe vivir en Massachusetts para solicitarlo.",
      details: "MassHealth es administrado por Massachusetts y requiere residencia en el estado. Visite healthcare.gov para explorar opciones donde vive ahora.",
      actionLabel: "Visitar healthcare.gov",
    }),
    masshealth_limited: () => ({
      program: "MassHealth Limited",
      tagline: "Los servicios de emergencia y embarazo pueden estar disponibles sin importar el estatus migratorio.",
      details: "Este programa puede cubrir atención de emergencia, parto, cuidado relacionado con el embarazo y ciertos tratamientos calificados.",
      actionLabel: "Solicitar MassHealth",
    }),
    pregnancy_undocumented_standard: () => ({
      program: "MassHealth Standard - Embarazo",
      tagline: "Puede haber cobertura completa para cuidado prenatal, parto y posparto.",
      details: "Las personas embarazadas pueden calificar para cobertura relacionada con el embarazo incluso sin un estatus migratorio calificado.",
      actionLabel: "Solicitar Ahora",
    }),
    pregnancy_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard - Embarazo",
      tagline: `Con ${fplPercent}% del FPL, puede haber cobertura completa para el embarazo.`,
      details: "La cobertura puede incluir visitas prenatales, ultrasonidos, parto en hospital y cuidado posparto.",
      actionLabel: "Solicitar Ahora",
    }),
    child_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Con ${fplPercent}% del FPL, un menor podría calificar para cobertura completa de Medicaid.`,
      details: "Esto puede incluir atención primaria, especialistas, dental, visión, salud conductual y medicamentos recetados.",
      actionLabel: "Solicitar Ahora",
    }),
    family_assistance_chip: ({ fplPercent }) => ({
      program: "MassHealth Family Assistance (CHIP)",
      tagline: `Con ${fplPercent}% del FPL, puede haber cobertura infantil de bajo costo.`,
      details: "Family Assistance ofrece cobertura integral para niños, con costos que varían según el ingreso.",
      actionLabel: "Solicitar Ahora",
    }),
    health_connector_child_plans: ({ fplPercent }) => ({
      program: "Planes del Health Connector",
      tagline: `Con ${fplPercent}% del FPL, los planes del mercado con créditos fiscales pueden ser la siguiente opción.`,
      details: "Las familias por encima del límite de CHIP aún pueden encontrar cobertura subsidiada a través del Massachusetts Health Connector.",
      actionLabel: "Explorar Planes",
    }),
    adult_disability_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Con elegibilidad por discapacidad e ingreso en ${fplPercent}% del FPL, podría haber cobertura completa de Medicaid.`,
      details: "Los adultos con discapacidad documentada o que reciben SSI/SSDI pueden calificar para atención médica, salud conductual y servicios de largo plazo.",
      actionLabel: "Solicitar Ahora",
    }),
    careplus: ({ fplPercent, householdSize, annualFPL }) => ({
      program: "MassHealth CarePlus",
      tagline: `Con ${fplPercent}% del FPL, podría haber Medicaid gratuito para adultos.`,
      details: `Los adultos de 19 a 64 años pueden calificar hasta el 138% del FPL, aproximadamente ${formatPrescreenerCurrency(Math.round(annualFPL * 1.38), "es")} al año para un hogar de ${householdSize} personas.`,
      actionLabel: "Solicitar Ahora",
    }),
    connectorcare: ({ fplPercent }) => ({
      program: "ConnectorCare",
      tagline: `Con ${fplPercent}% del FPL, podrían estar disponibles planes subsidiados a través del Massachusetts Health Connector.`,
      details: "ConnectorCare puede reducir primas y copagos para adultos que no califican para MassHealth pero aún están dentro del límite de ingresos.",
      actionLabel: "Ver Planes",
    }),
    federal_tax_credits: ({ fplPercent }) => ({
      program: "Health Connector con Créditos Fiscales Federales",
      tagline: `Con ${fplPercent}% del FPL, los subsidios federales pueden reducir el costo mensual.`,
      details: "Los créditos fiscales anticipados pueden reducir el costo del seguro del mercado según el ingreso, el tamaño del hogar y el plan elegido.",
      actionLabel: "Ver Planes",
    }),
    employer_or_connector: ({ fplPercent }) => ({
      program: "Health Connector o Planes del Empleador",
      tagline: `Con ${fplPercent}% del FPL, la mejor opción puede ser un plan sin subsidio o la cobertura del empleador.`,
      details: "Si el ingreso está por encima del rango de subsidios, compare la cobertura del empleador con los planes del Massachusetts Health Connector.",
      actionLabel: "Explorar Planes",
    }),
    medicare_savings_program_adult: ({ fplPercent }) => ({
      program: "Programa de Ahorros de Medicare",
      tagline: `Con Medicare e ingreso en ${fplPercent}% del FPL, MassHealth podría ayudar con los costos de Medicare.`,
      details: "Este programa puede ayudar a pagar la prima de la Parte B y también reducir deducibles y copagos.",
      actionLabel: "Solicitar por MassHealth",
    }),
    employer_sponsored_insurance: () => ({
      program: "Seguro Patrocinado por el Empleador",
      tagline: "La cobertura del empleador puede ser la opción más asequible.",
      details: "Si el plan del empleador cumple con las reglas de asequibilidad y valor mínimo, los subsidios del mercado suelen ser limitados o no estar disponibles.",
      actionLabel: "Revisar Beneficios del Empleador",
    }),
    dual_eligible_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard (Elegibilidad Dual)",
      tagline: `Con ${fplPercent}% del FPL, MassHealth podría cubrir costos compartidos de Medicare y beneficios adicionales.`,
      details: "La elegibilidad dual puede ayudar con primas de Medicare, deducibles, copagos y algunos servicios que Medicare no cubre.",
      actionLabel: "Solicitar Ahora",
    }),
    medicare_savings_program_senior: ({ fplPercent }) => ({
      program: "Programa de Ahorros de Medicare",
      tagline: `Con ${fplPercent}% del FPL, MassHealth podría ayudar a pagar primas y costos compartidos de Medicare.`,
      details: "Los adultos mayores dentro del límite del programa pueden recibir ayuda con la prima de la Parte B y algunos deducibles y copagos.",
      actionLabel: "Solicitar por MassHealth",
    }),
    medigap_plans: ({ fplPercent }) => ({
      program: "Planes Suplementarios de Medicare (Medigap)",
      tagline: `Con ${fplPercent}% del FPL, la cobertura suplementaria podría ayudar a cubrir los vacíos de Medicare.`,
      details: "Si el ingreso supera el límite del Programa de Ahorros de Medicare, compare Medigap y Medicare Advantage para reducir gastos de bolsillo.",
      actionLabel: "Comparar Planes de Medicare",
    }),
    senior_no_medicare_standard: () => ({
      program: "MassHealth Standard",
      tagline: "Podría haber cobertura mientras se resuelve la inscripción en Medicare.",
      details: "Los adultos mayores que todavía no están inscritos en Medicare podrían necesitar una revisión completa de elegibilidad a través de MassHealth.",
      actionLabel: "Contactar a MassHealth",
    }),
    full_application_recommended: () => ({
      program: "Se Recomienda Solicitud Completa",
      tagline: "Una solicitud completa es la mejor manera de confirmar la elegibilidad exacta.",
      details: "Sus respuestas indican que se necesita una revisión más detallada. La solicitud completa recopilará la información necesaria para una decisión oficial.",
      actionLabel: "Comenzar Solicitud",
    }),
  },
  vi: {
    not_eligible_non_ma: () => ({
      program: "Không Đủ Điều Kiện cho MassHealth",
      tagline: "Bạn phải sống tại Massachusetts để nộp đơn.",
      details: "MassHealth do bang Massachusetts quản lý và yêu cầu cư trú tại bang này. Hãy truy cập healthcare.gov để xem lựa chọn tại nơi bạn đang sống.",
      actionLabel: "Truy cập healthcare.gov",
    }),
    masshealth_limited: () => ({
      program: "MassHealth Limited",
      tagline: "Dịch vụ cấp cứu và thai sản có thể có sẵn bất kể tình trạng di trú.",
      details: "Chương trình này có thể chi trả chăm sóc cấp cứu, sinh nở, chăm sóc liên quan đến thai kỳ và một số điều trị đủ điều kiện.",
      actionLabel: "Nộp đơn MassHealth",
    }),
    pregnancy_undocumented_standard: () => ({
      program: "MassHealth Standard - Thai kỳ",
      tagline: "Có thể có bảo hiểm đầy đủ cho chăm sóc trước sinh, sinh nở và sau sinh.",
      details: "Người đang mang thai vẫn có thể đủ điều kiện nhận bảo hiểm liên quan đến thai kỳ ngay cả khi không có tình trạng di trú đủ điều kiện.",
      actionLabel: "Nộp đơn ngay",
    }),
    pregnancy_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard - Thai kỳ",
      tagline: `Ở mức ${fplPercent}% FPL, có thể có bảo hiểm thai kỳ đầy đủ.`,
      details: "Bảo hiểm có thể bao gồm khám thai, siêu âm, sinh tại bệnh viện và chăm sóc sau sinh.",
      actionLabel: "Nộp đơn ngay",
    }),
    child_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Ở mức ${fplPercent}% FPL, trẻ em có thể đủ điều kiện nhận Medicaid đầy đủ.`,
      details: "Bảo hiểm có thể bao gồm chăm sóc ban đầu, chuyên khoa, nha khoa, thị lực, sức khỏe hành vi và thuốc kê toa.",
      actionLabel: "Nộp đơn ngay",
    }),
    family_assistance_chip: ({ fplPercent }) => ({
      program: "MassHealth Family Assistance (CHIP)",
      tagline: `Ở mức ${fplPercent}% FPL, có thể có bảo hiểm trẻ em chi phí thấp.`,
      details: "Family Assistance cung cấp bảo hiểm toàn diện cho trẻ em với chi phí thay đổi theo mức thu nhập.",
      actionLabel: "Nộp đơn ngay",
    }),
    health_connector_child_plans: ({ fplPercent }) => ({
      program: "Các gói Health Connector",
      tagline: `Ở mức ${fplPercent}% FPL, các gói thị trường có tín dụng thuế có thể là lựa chọn tiếp theo.`,
      details: "Các gia đình vượt giới hạn CHIP vẫn có thể tìm được bảo hiểm trợ cấp qua Massachusetts Health Connector.",
      actionLabel: "Xem các gói",
    }),
    adult_disability_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard",
      tagline: `Với điều kiện liên quan đến khuyết tật và thu nhập ở mức ${fplPercent}% FPL, có thể có Medicaid đầy đủ.`,
      details: "Người lớn có khuyết tật được ghi nhận hoặc nhận SSI/SSDI có thể đủ điều kiện cho chăm sóc y tế, sức khỏe hành vi và dịch vụ dài hạn.",
      actionLabel: "Nộp đơn ngay",
    }),
    careplus: ({ fplPercent, householdSize, annualFPL }) => ({
      program: "MassHealth CarePlus",
      tagline: `Ở mức ${fplPercent}% FPL, người lớn có thể nhận Medicaid miễn phí.`,
      details: `Người lớn 19-64 tuổi có thể đủ điều kiện đến 138% FPL, khoảng ${formatPrescreenerCurrency(Math.round(annualFPL * 1.38), "vi")} mỗi năm cho hộ gia đình ${householdSize} người.`,
      actionLabel: "Nộp đơn ngay",
    }),
    connectorcare: ({ fplPercent }) => ({
      program: "ConnectorCare",
      tagline: `Ở mức ${fplPercent}% FPL, có thể có các gói trợ cấp qua Massachusetts Health Connector.`,
      details: "ConnectorCare có thể giảm phí bảo hiểm và đồng chi trả cho người lớn không đủ điều kiện MassHealth nhưng vẫn trong giới hạn thu nhập.",
      actionLabel: "Xem các gói",
    }),
    federal_tax_credits: ({ fplPercent }) => ({
      program: "Health Connector với Tín dụng Thuế Liên bang",
      tagline: `Ở mức ${fplPercent}% FPL, trợ cấp liên bang có thể giúp giảm chi phí hàng tháng.`,
      details: "Tín dụng thuế trả trước có thể giảm chi phí bảo hiểm thị trường dựa trên thu nhập, quy mô hộ gia đình và gói bạn chọn.",
      actionLabel: "Kiểm tra các gói",
    }),
    employer_or_connector: ({ fplPercent }) => ({
      program: "Health Connector hoặc Bảo hiểm từ Chủ lao động",
      tagline: `Ở mức ${fplPercent}% FPL, gói không trợ cấp hoặc bảo hiểm từ chủ lao động có thể phù hợp hơn.`,
      details: "Nếu thu nhập cao hơn mức trợ cấp, hãy so sánh bảo hiểm do chủ lao động cung cấp với các gói trên Massachusetts Health Connector.",
      actionLabel: "Xem các gói",
    }),
    medicare_savings_program_adult: ({ fplPercent }) => ({
      program: "Chương trình Tiết kiệm Medicare",
      tagline: `Với Medicare và thu nhập ở mức ${fplPercent}% FPL, MassHealth có thể giúp trả chi phí Medicare.`,
      details: "Chương trình này có thể giúp trả phí Part B và cũng có thể giảm khoản khấu trừ và đồng chi trả.",
      actionLabel: "Nộp qua MassHealth",
    }),
    employer_sponsored_insurance: () => ({
      program: "Bảo hiểm do Chủ lao động Tài trợ",
      tagline: "Bảo hiểm của chủ lao động có thể là lựa chọn hợp túi tiền nhất.",
      details: "Nếu gói của chủ lao động đáp ứng tiêu chuẩn về khả năng chi trả và giá trị tối thiểu, trợ cấp trên thị trường thường sẽ bị hạn chế hoặc không có.",
      actionLabel: "Xem quyền lợi từ chủ lao động",
    }),
    dual_eligible_standard: ({ fplPercent }) => ({
      program: "MassHealth Standard (Đủ điều kiện kép)",
      tagline: `Ở mức ${fplPercent}% FPL, MassHealth có thể hỗ trợ chi phí Medicare và quyền lợi bổ sung.`,
      details: "Tình trạng đủ điều kiện kép có thể giúp trả phí Medicare, khoản khấu trừ, đồng chi trả và một số dịch vụ Medicare không bao gồm.",
      actionLabel: "Nộp đơn ngay",
    }),
    medicare_savings_program_senior: ({ fplPercent }) => ({
      program: "Chương trình Tiết kiệm Medicare",
      tagline: `Ở mức ${fplPercent}% FPL, MassHealth có thể giúp trả phí bảo hiểm và chi phí chia sẻ Medicare.`,
      details: "Người lớn tuổi trong giới hạn chương trình có thể được hỗ trợ phí Part B và một số khoản khấu trừ, đồng chi trả.",
      actionLabel: "Nộp qua MassHealth",
    }),
    medigap_plans: ({ fplPercent }) => ({
      program: "Các gói Bổ sung Medicare (Medigap)",
      tagline: `Ở mức ${fplPercent}% FPL, bảo hiểm bổ sung có thể giúp lấp khoảng trống của Medicare.`,
      details: "Nếu thu nhập cao hơn giới hạn của Chương trình Tiết kiệm Medicare, hãy so sánh Medigap và Medicare Advantage để giảm chi phí tự trả.",
      actionLabel: "So sánh các gói Medicare",
    }),
    senior_no_medicare_standard: () => ({
      program: "MassHealth Standard",
      tagline: "Có thể vẫn có bảo hiểm trong khi đang xử lý việc ghi danh Medicare.",
      details: "Người lớn tuổi chưa ghi danh Medicare có thể vẫn cần được MassHealth xem xét điều kiện đầy đủ.",
      actionLabel: "Liên hệ MassHealth",
    }),
    full_application_recommended: () => ({
      program: "Khuyến nghị nộp Hồ sơ Đầy đủ",
      tagline: "Nộp hồ sơ đầy đủ là cách tốt nhất để xác nhận chính xác điều kiện.",
      details: "Câu trả lời của bạn cho thấy cần xem xét chi tiết hơn. Hồ sơ đầy đủ sẽ thu thập thông tin cần thiết cho quyết định chính thức.",
      actionLabel: "Bắt đầu hồ sơ",
    }),
  },
}

function localizeResult(result: EligibilityResult, language: SupportedLanguage, context: ResultContext): EligibilityResult {
  const localizedFields = RESULT_COPY[language][result.code]?.(context)
  if (!localizedFields) return result

  return {
    ...result,
    ...localizedFields,
  }
}

function buildLocalizedSummary(results: EligibilityResult[], language: SupportedLanguage): string {
  const copy = getPrescreenerCopy(language)
  const topResult = results[0]
  if (!topResult) return copy.summaryFallback
  if (topResult.code === "not_eligible_non_ma") return copy.summaryNonMA
  if (topResult.status === "likely") return copy.summaryLikely(topResult.program)
  if (topResult.status === "possibly") return copy.summaryPossibly
  return copy.summaryUnlikely
}

export function getEligibilityBadgeLabel(language: SupportedLanguage, color: EligibilityColor): string {
  return BADGE_LABELS[language][color]
}

export function localizeEligibilityReport(
  report: EligibilityReport,
  screenerData: Partial<ScreenerData>,
  language: SupportedLanguage,
): EligibilityReport {
  const context: ResultContext = {
    annualFPL: report.annualFPL,
    fplPercent: report.fplPercent,
    householdSize: screenerData.householdSize ?? 1,
  }

  const results = report.results.map((result) => localizeResult(result, language, context))

  return {
    ...report,
    results,
    summary: buildLocalizedSummary(results, language),
  }
}
