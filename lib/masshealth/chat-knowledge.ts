import { type SupportedLanguage } from "@/lib/i18n/languages"

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface MassHealthLink {
  label: string
  url: string
}

export interface MassHealthFaqItem {
  id: string
  question: string
  quickAnswer: string
  links: MassHealthLink[]
}

const MASSHEALTH_KEYWORDS = [
  "masshealth",
  "mass health",
  "medicaid",
  "ma login",
  "myservices",
  "health safety net",
  "children's medical security plan",
  "cmsp",
  "coverage",
  "health insurance",
  "insurance",
  "eligibility",
  "application",
  "apply",
  "enroll",
  "renew",
  "renewal",
  "redetermination",
  "income",
  "household",
  "report changes",
  "verification",
  "appeal",
  "benefits",
  "covered services",
  "provider",
  "member card",
  "commonhealth",
  "long-term care",
  "seniors",
  "children",
  "child",
  "family",
  "adult",
  "disability",
]

export const MASSHEALTH_OUT_OF_SCOPE_RESPONSE =
  "Sorry, I can only answer MassHealth-related questions."

const OUT_OF_SCOPE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: "Sorry, I can only answer MassHealth-related questions.",
  "zh-CN": "Sorry, I can only answer MassHealth-related questions.",
  ht: "Padon, mwen ka reponn selman kestyon ki gen rapo ak MassHealth.",
  "pt-BR": "Desculpe, so posso responder perguntas relacionadas ao MassHealth.",
  es: "Lo siento, solo puedo responder preguntas relacionadas con MassHealth.",
  vi: "Xin loi, toi chi co the tra loi cac cau hoi lien quan den MassHealth.",
}

const CHAT_GREETING_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: "Hi, I'm your MassHealth assistant. Ask me about eligibility, applications, renewals, covered services, documents, or appeals.",
  "zh-CN": "Hi, I'm your MassHealth assistant. Ask me about eligibility, applications, renewals, covered services, documents, or appeals.",
  ht: "Bonjou, mwen se asistan MassHealth ou. Mande m sou kalifikasyon, aplikasyon, renouvelman, benefis, dokiman, oswa apel.",
  "pt-BR": "Ola, sou seu assistente MassHealth. Pergunte sobre elegibilidade, inscricao, renovacao, servicos cobertos, documentos ou recursos.",
  es: "Hola, soy su asistente de MassHealth. Pregunte sobre elegibilidad, solicitud, renovacion, servicios cubiertos, documentos o apelaciones.",
  vi: "Xin chao, toi la tro ly MassHealth cua ban. Hay hoi ve dieu kien, nop don, gia han, dich vu duoc bao hiem, tai lieu hoac khieu nai.",
}

const LANGUAGE_RESPONSE_HINT: Record<SupportedLanguage, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese",
  ht: "Haitian Creole",
  "pt-BR": "Brazilian Portuguese",
  es: "Spanish",
  vi: "Vietnamese",
}

export const MASSHEALTH_COMMON_QUESTIONS: MassHealthFaqItem[] = [
  {
    id: "apply",
    question: "How do I apply for MassHealth coverage?",
    quickAnswer:
      "You can apply online through MA Login. You may also apply for related programs like Health Safety Net and CMSP from the same application flow.",
    links: [
      {
        label: "Apply for MassHealth, Health Safety Net, or CMSP",
        url: "https://www.mass.gov/how-to/apply-for-masshealth-the-health-safety-net-or-the-childrens-medical-security-plan",
      },
      {
        label: "Apply for health coverage",
        url: "https://www.mass.gov/how-to/apply-for-health-coverage",
      },
    ],
  },
  {
    id: "docs",
    question: "What documents do I usually need when applying?",
    quickAnswer:
      "Applicants are commonly asked for Social Security numbers (if available), tax and income details, and citizenship or immigration information.",
    links: [
      {
        label: "Application details and required information",
        url: "https://www.mass.gov/how-to/apply-for-masshealth-the-health-safety-net-or-the-childrens-medical-security-plan",
      },
      {
        label: "Acceptable verifications list",
        url: "https://www.mass.gov/doc/masshealth-and-health-connector-acceptable-verifications-list/download",
      },
    ],
  },
  {
    id: "renewal",
    question: "How do I renew my MassHealth coverage?",
    quickAnswer:
      "MassHealth renewals are required periodically. You can renew through official MassHealth renewal channels and should respond quickly to renewal notices.",
    links: [
      {
        label: "Renew your MassHealth coverage",
        url: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
      },
      {
        label: "Renew your coverage",
        url: "https://www.mass.gov/how-to/renew-your-coverage",
      },
    ],
  },
  {
    id: "changes",
    question: "How do I report a change in income, address, or household?",
    quickAnswer:
      "You should report major household changes as soon as possible so eligibility and benefits stay accurate.",
    links: [
      {
        label: "Report household changes to MassHealth",
        url: "https://www.mass.gov/how-to/report-household-changes-to-masshealth",
      },
    ],
  },
  {
    id: "eligibility-u65",
    question: "How is eligibility decided for adults and families under 65?",
    quickAnswer:
      "Eligibility depends on factors like household size, age, disability status, and income rules for each program category.",
    links: [
      {
        label: "Eligibility programs for families, children, and adults under 65",
        url: "https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-65-and-younger",
      },
    ],
  },
  {
    id: "eligibility-senior",
    question: "Is MassHealth different for seniors or long-term-care applicants?",
    quickAnswer:
      "Yes. Seniors and people needing long-term-care services can have different eligibility pathways and application support channels.",
    links: [
      {
        label: "Eligibility for people 65+ and certain disabilities",
        url: "https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-aged-65-and-older-and-people-with-certain-disabilities",
      },
      {
        label: "Apply for senior or long-term-care coverage",
        url: "https://www.mass.gov/how-to/apply-for-masshealth-coverage-for-seniors-and-people-of-any-age-who-need-long-term-care-services",
      },
    ],
  },
  {
    id: "services",
    question: "What services does MassHealth cover?",
    quickAnswer:
      "Covered services depend on your MassHealth plan and eligibility category. Official service pages list covered and program-specific benefits.",
    links: [
      {
        label: "Learn about MassHealth covered services",
        url: "https://www.mass.gov/info-details/learn-about-masshealth-covered-services",
      },
      {
        label: "MassHealth for children and young adults",
        url: "https://www.mass.gov/info-details/masshealth-for-children-and-young-adults",
      },
    ],
  },
  {
    id: "card",
    question: "How do I replace a lost MassHealth card?",
    quickAnswer:
      "You can request a replacement card through MassHealth support resources. Some members receive different coverage documentation depending on program type.",
    links: [
      {
        label: "Request a MassHealth card",
        url: "https://www.mass.gov/how-to/request-a-masshealth-card",
      },
    ],
  },
  {
    id: "help",
    question: "Where can I get help with my application?",
    quickAnswer:
      "MassHealth offers phone and in-person support, including enrollment assisters and language support services.",
    links: [
      {
        label: "Find help with your application",
        url: "https://www.mass.gov/how-to/find-help-with-your-masshealth-insurance-application",
      },
      {
        label: "Find help applying or enrolling",
        url: "https://www.mass.gov/how-to/find-help-applying-for-or-enrolling-in-masshealth-the-health-safety-net-or-the-childrens-medical-security-plan",
      },
    ],
  },
  {
    id: "appeal",
    question: "How do I appeal a MassHealth decision?",
    quickAnswer:
      "If you disagree with a decision, follow the official appeal process and deadlines provided in your notice.",
    links: [
      {
        label: "How to appeal a MassHealth decision",
        url: "https://www.mass.gov/how-to/how-to-appeal-a-masshealth-decision",
      },
    ],
  },
  {
    id: "commonhealth",
    question: "What is MassHealth CommonHealth?",
    quickAnswer:
      "MassHealth CommonHealth is a program designed for individuals with disabilities who may not qualify under standard income-based pathways.",
    links: [
      {
        label: "Learn about MassHealth CommonHealth",
        url: "https://www.mass.gov/info-details/learn-about-masshealth-commonhealth",
      },
    ],
  },
]

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim()
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

function hasFaqKeywordOverlap(message: string): boolean {
  const messageTokens = new Set(tokenize(message))

  if (messageTokens.size === 0) {
    return false
  }

  return MASSHEALTH_COMMON_QUESTIONS.some((faq) => {
    const questionTokens = tokenize(faq.question).filter((token) => token.length > 3)
    const overlapCount = questionTokens.filter((token) => messageTokens.has(token)).length

    return overlapCount >= 2
  })
}

export function isMassHealthTopic(message: string): boolean {
  const normalized = normalizeText(message)

  if (!normalized) {
    return true
  }

  if (MASSHEALTH_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true
  }

  if (hasFaqKeywordOverlap(normalized)) {
    return true
  }

  return false
}

export function getMassHealthOutOfScopeResponse(language: SupportedLanguage): string {
  return OUT_OF_SCOPE_BY_LANGUAGE[language] ?? MASSHEALTH_OUT_OF_SCOPE_RESPONSE
}

export function getMassHealthGreeting(language: SupportedLanguage): string {
  return CHAT_GREETING_BY_LANGUAGE[language] ?? CHAT_GREETING_BY_LANGUAGE.en
}

function formatKnowledgeBaseForPrompt(): string {
  const faqBlocks = MASSHEALTH_COMMON_QUESTIONS.map((faq, index) => {
    const links = faq.links.map((link) => `${link.label}: ${link.url}`).join("\n")

    return [
      `${index + 1}. ${faq.question}`,
      `Answer summary: ${faq.quickAnswer}`,
      `Official links:\n${links}`,
    ].join("\n")
  })

  return faqBlocks.join("\n\n")
}

export function buildMassHealthSystemPrompt(language: SupportedLanguage): string {
  const outOfScopeResponse = getMassHealthOutOfScopeResponse(language)
  const responseLanguage = LANGUAGE_RESPONSE_HINT[language] ?? LANGUAGE_RESPONSE_HINT.en

  return [
    "You are a MassHealth-only virtual assistant.",
    "Follow these rules strictly:",
    "1) Answer only questions related to MassHealth programs, eligibility, enrollment, renewal, benefits, and member services.",
    `2) If the question is outside this scope, respond exactly with: ${outOfScopeResponse}`,
    "3) Do not invent policy details, income thresholds, or legal claims. If exact policy numbers are required, direct users to official links or MassHealth support.",
    "4) Keep answers concise, practical, and clear. Include official links when helpful.",
    "5) Mention this is informational support and users should verify final decisions with MassHealth.",
    `6) Respond in ${responseLanguage}.`,
    "",
    "Known MassHealth references and FAQ guidance:",
    formatKnowledgeBaseForPrompt(),
    "",
    "MassHealth support contact:",
    "MassHealth Customer Service Center: (800) 841-2900, TTY: 711",
    "Self-service is available 24/7 in English and Spanish. Live services are typically Monday-Friday, 8:00 a.m.-5:00 p.m.",
  ].join("\n")
}
