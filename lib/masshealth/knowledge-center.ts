/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { type SupportedLanguage } from "@/lib/i18n/languages"

// Types are defined in types.ts; re-exported here for backward compatibility.
export type { KnowledgeVideo, KnowledgeArticle, KnowledgeDocument } from "./types"
import type { KnowledgeVideo, KnowledgeArticle, KnowledgeDocument } from "./types"

export const KNOWLEDGE_VIDEOS: KnowledgeVideo[] = [
  // --- Member actions & renewals (short, patient-facing) ---
  {
    id: "renewals-what-why-when",
    title: "MassHealth Renewals 101: The What, Why and When",
    description:
      "Quick overview of why renewals happen, when to expect them, and what members need to do.",
    youtubeId: "FyeCQhHhCTk",
    youtubeUrl: "https://www.youtube.com/watch?v=FyeCQhHhCTk",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "renewals-blue-envelope",
    title: "MassHealth Renewals 101: What to do if you get a Blue Envelope",
    description:
      "Step-by-step guidance for members who receive a blue renewal envelope in the mail.",
    youtubeId: "oBFtv5ly04s",
    youtubeUrl: "https://www.youtube.com/watch?v=oBFtv5ly04s",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "update-information",
    title: "How to Update Your Information with MassHealth",
    description:
      "How to report address, income, or household changes so your coverage stays accurate.",
    youtubeId: "ULoCcsm4Yl4",
    youtubeUrl: "https://www.youtube.com/watch?v=ULoCcsm4Yl4",
    sourceUrl: "https://www.mass.gov/how-to/report-changes-to-masshealth",
    availableLanguages: ["en"],
  },
  {
    id: "what-to-do-lose-masshealth",
    title: "What to do if You Lose MassHealth",
    description:
      "Options and next steps if your MassHealth coverage ends or is terminated.",
    youtubeId: "DZIOdk3sPfI",
    youtubeUrl: "https://www.youtube.com/watch?v=DZIOdk3sPfI",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "act-now-stay-covered",
    title: "MassHealth – Act Now, Stay Covered",
    description:
      "Reminder video encouraging members to respond to renewal notices to keep their coverage.",
    youtubeId: "pj_Qzx0o6YY",
    youtubeUrl: "https://www.youtube.com/watch?v=pj_Qzx0o6YY",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "renewals-where-to-get-help",
    title: "MassHealth Renewals 101: Where to Get Help",
    description:
      "Explains the different places members can go for assistance with their renewal.",
    youtubeId: "9DCpbh-iqAo",
    youtubeUrl: "https://www.youtube.com/watch?v=9DCpbh-iqAo",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "renewals-how-to-prepare",
    title: "MassHealth Renewals 101: How to Prepare",
    description:
      "What documents and information to gather before completing your MassHealth renewal.",
    youtubeId: "T3jS1P1d3Ao",
    youtubeUrl: "https://www.youtube.com/watch?v=T3jS1P1d3Ao",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "renewals-initiate-early",
    title: "MassHealth Renewals 101: Initiating a Renewal Before you Receive a Blue Envelope",
    description:
      "How to proactively start your renewal before the official notice arrives.",
    youtubeId: "OkmoR1TNLGY",
    youtubeUrl: "https://www.youtube.com/watch?v=OkmoR1TNLGY",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "renewals-final-tips",
    title: "MassHealth Renewals 101: Final Tips",
    description:
      "Key reminders and final tips to ensure a smooth MassHealth renewal process.",
    youtubeId: "wgHnioGm-fY",
    youtubeUrl: "https://www.youtube.com/watch?v=wgHnioGm-fY",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  {
    id: "disabilities-renewals",
    title: "Supporting Members with Disabilities with MassHealth Renewals",
    description:
      "Guidance on renewal accommodations and support for members with disabilities.",
    youtubeId: "3NMgWZGrqlo",
    youtubeUrl: "https://www.youtube.com/watch?v=3NMgWZGrqlo",
    sourceUrl: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
    availableLanguages: ["en"],
  },
  // --- Claims & benefits ---
  {
    id: "what-is-pca",
    title: "What is a MassHealth PCA?",
    description:
      "Introduces the Personal Care Attendant program for members who need in-home assistance.",
    youtubeId: "afD72HhNTFc",
    youtubeUrl: "https://www.youtube.com/watch?v=afD72HhNTFc",
    sourceUrl: "https://www.mass.gov/what-is-a-masshealth-pca",
    availableLanguages: ["en"],
  },
  {
    id: "claim-status",
    title: "How to Check a Claim Status",
    description:
      "Official walkthrough for checking MassHealth claim status online.",
    youtubeId: "4FR5_n_8IDg",
    youtubeUrl: "https://www.youtube.com/watch?v=4FR5_n_8IDg",
    sourceUrl: "https://www.mass.gov/info-details/how-to-check-a-masshealth-claim-status",
    availableLanguages: ["en"],
  },
  // --- MassHealth 101 Webinar Series ---
  {
    id: "webinar-1-eligibility",
    title: "MassHealth 101 Webinar Series 1 – Eligibility and Enrollment",
    description:
      "In-depth webinar covering MassHealth eligibility rules and enrollment processes.",
    youtubeId: "-6rromEb5R8",
    youtubeUrl: "https://www.youtube.com/watch?v=-6rromEb5R8",
    sourceUrl: "https://www.mass.gov/info-details/masshealth-webinars-for-homeless-providers",
    availableLanguages: ["en"],
  },
  {
    id: "webinar-2-ltss",
    title: "MassHealth 101 Webinar Series 2 – Long Term Services and Supports",
    description:
      "Covers LTSS options including home and community-based services available through MassHealth.",
    youtubeId: "I9KoDRwOB7k",
    youtubeUrl: "https://www.youtube.com/watch?v=I9KoDRwOB7k",
    sourceUrl: "https://www.mass.gov/info-details/masshealth-webinars-for-homeless-providers",
    availableLanguages: ["en"],
  },
  {
    id: "webinar-3-substance-use",
    title: "MassHealth 101 Webinar Series 3 – Substance Use Disorders",
    description:
      "Webinar on substance use disorder treatment and addiction services available through MassHealth.",
    youtubeId: "4EE3krwQkvY",
    youtubeUrl: "https://www.youtube.com/watch?v=4EE3krwQkvY",
    sourceUrl: "https://www.mass.gov/info-details/masshealth-webinars-for-homeless-providers",
    availableLanguages: ["en"],
  },
  {
    id: "webinar-4-behavioral-health",
    title: "MassHealth 101 Webinar Series 4 – Behavioral Health",
    description:
      "Webinar on behavioral health support services and mental health coverage through MassHealth.",
    youtubeId: "1UBQXp8kOF4",
    youtubeUrl: "https://www.youtube.com/watch?v=1UBQXp8kOF4",
    sourceUrl: "https://www.mass.gov/info-details/masshealth-webinars-for-homeless-providers",
    availableLanguages: ["en"],
  },
]

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "renew",
    title: "Renew your MassHealth coverage",
    description:
      "Official renewal instructions and channels to keep your benefits active.",
    url: "https://www.mass.gov/how-to/renew-your-masshealth-coverage",
  },
  {
    id: "apply",
    title: "Apply for MassHealth, the Health Safety Net, or CMSP",
    description:
      "Application guidance and eligibility details for major coverage pathways.",
    url: "https://www.mass.gov/how-to/apply-for-masshealth-the-health-safety-net-or-the-childrens-medical-security-plan",
  },
  {
    id: "covered-services",
    title: "Learn about MassHealth covered services",
    description:
      "Official guidance on covered services and program differences.",
    url: "https://www.mass.gov/info-details/masshealth-covered-services",
  },
  {
    id: "contact",
    title: "Contact information for MassHealth members",
    description:
      "Official support channels and member contact information.",
    url: "https://www.mass.gov/info-details/contact-masshealth-information-for-members",
  },
  {
    id: "changes",
    title: "Report household changes to MassHealth",
    description:
      "How to report income, address, and household updates to MassHealth.",
    url: "https://www.mass.gov/how-to/report-changes-to-masshealth",
  },
  {
    id: "faq-under-65",
    title: "FAQ for people under age 65",
    description:
      "Frequently asked questions for adults, families, and children under 65.",
    url: "https://www.mass.gov/info-details/frequently-asked-questions-for-masshealth-members-younger-than-65",
  },
  {
    id: "faq-65-plus",
    title: "FAQ for people age 65 and older",
    description:
      "Frequently asked questions for seniors and disability-related pathways.",
    url: "https://www.mass.gov/info-details/frequently-asked-questions-for-masshealth-members-aged-65-and-older",
  },
  {
    id: "appeal",
    title: "How to appeal a MassHealth decision",
    description:
      "Official appeal steps for eligibility or authorization decisions.",
    url: "https://www.mass.gov/how-to/how-to-appeal-a-masshealth-decision",
  },
  {
    id: "applicant-info",
    title: "Information for MassHealth applicants",
    description:
      "Overview of what to expect when applying, including required documents and timelines.",
    url: "https://www.mass.gov/information-for-masshealth-applicants",
  },
  {
    id: "covered-services-chart",
    title: "Chart of MassHealth covered services",
    description:
      "Side-by-side chart of benefits by MassHealth coverage type — Standard, CarePlus, CommonHealth, and more.",
    url: "https://www.mass.gov/info-details/chart-of-masshealth-covered-services",
  },
  {
    id: "online-account",
    title: "MassHealth MA Login accounts",
    description:
      "How to create and use your online account to manage benefits, view letters, and update information.",
    url: "https://www.mass.gov/masshealth-ma-login-accounts",
  },
  {
    id: "hipaa-info",
    title: "HIPAA information for MassHealth members",
    description:
      "Member privacy rights, how your health information is protected, and how to file a privacy complaint.",
    url: "https://www.mass.gov/hipaa-information-for-masshealth-members",
  },
]

export const KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "doc-acceptable-verifications",
    title: "Acceptable Verifications List (PDF)",
    description:
      "Official verification checklist for identity, residency, income, and other eligibility items.",
    url: "https://www.mass.gov/doc/masshealth-and-health-connector-acceptable-verifications-list/download",
  },
  {
    id: "doc-member-forms",
    title: "MassHealth Member Forms",
    description:
      "Official member forms for applications, authorizations, updates, and member requests.",
    url: "https://www.mass.gov/lists/masshealth-member-forms",
  },
  {
    id: "doc-member-guides",
    title: "MassHealth Member Guides and Handbooks",
    description:
      "Program handbooks and member guidance documents from MassHealth.",
    url: "https://www.mass.gov/lists/masshealth-member-guides-and-handbooks",
  },
  {
    id: "doc-hipaa-forms",
    title: "HIPAA Forms for MassHealth Members",
    description:
      "Privacy and authorization forms for members and authorized representatives.",
    url: "https://www.mass.gov/lists/hipaa-forms-for-masshealth-members",
  },
]

type DocumentTranslation = { title: string; description: string }

const KNOWLEDGE_COPY: Record<
  SupportedLanguage,
  {
    pageTitle: string
    pageDescription: string
    languageLabel: string
    sectionVideos: string
    sectionArticles: string
    sectionDocuments: string
    viewMore: string
    openOnYoutube: string
    openArticle: string
    openSource: string
    officialMassGov: string
    sourcePage: string
    showingEnglish: string
    translatedViaGoogle: string
    documents: Record<string, DocumentTranslation>
  }
> = {
  en: {
    pageTitle: "MassHealth Knowledge Center",
    pageDescription:
      "Browse official MassHealth videos, articles, and downloadable documents.",
    languageLabel: "Language",
    sectionVideos: "Videos",
    sectionArticles: "Articles",
    sectionDocuments: "Documents",
    viewMore: "View more",
    openOnYoutube: "Open on YouTube",
    openArticle: "Open Article",
    openSource: "Open Source",
    officialMassGov: "Official Mass.gov",
    sourcePage: "Source page",
    showingEnglish: "Showing official English videos for this topic.",
    translatedViaGoogle: "",
    documents: {},
  },
  "zh-CN": {
    pageTitle: "MassHealth 知识中心",
    pageDescription:
      "浏览 MassHealth 官方视频、文章和可下载文件。",
    languageLabel: "语言",
    sectionVideos: "视频",
    sectionArticles: "文章",
    sectionDocuments: "文件",
    viewMore: "更多",
    openOnYoutube: "在 YouTube 上打开",
    openArticle: "打开文章",
    openSource: "打开资源",
    officialMassGov: "Mass.gov 官方",
    sourcePage: "来源页面",
    showingEnglish: "当前主题仅显示英文官方视频。",
    translatedViaGoogle: "由 Google 翻译提供",
    documents: {
      "doc-acceptable-verifications": {
        title: "可接受验证列表 (PDF)",
        description: "身份、居住地、收入及其他资格项目的官方验证清单。",
      },
      "doc-member-forms": {
        title: "MassHealth 会员表格",
        description: "申请、授权、更新和会员请求的官方表格。",
      },
      "doc-member-guides": {
        title: "MassHealth 会员指南和手册",
        description: "MassHealth 的项目手册和会员指导文件。",
      },
      "doc-hipaa-forms": {
        title: "MassHealth 会员的 HIPAA 表格",
        description: "会员和授权代表的隐私和授权表格。",
      },
    },
  },
  ht: {
    pageTitle: "Sant Konesans MassHealth",
    pageDescription:
      "Gade videyo, atik, ak dokiman ofisyel MassHealth ou ka telechaje.",
    languageLabel: "Lang",
    sectionVideos: "Videyo",
    sectionArticles: "Atik",
    sectionDocuments: "Dokiman",
    viewMore: "W e plis",
    openOnYoutube: "Louvri sou YouTube",
    openArticle: "Louvri Atik",
    openSource: "Louvri Sous",
    officialMassGov: "Ofisyel Mass.gov",
    sourcePage: "Paj sous",
    showingEnglish: "Videyo ofisyel yo disponib an Angle pou sij e sa a.",
    translatedViaGoogle: "Tradui pa Google",
    documents: {
      "doc-acceptable-verifications": {
        title: "Lis Verifikasyon Akseptab (PDF)",
        description: "Lis verifikasyon ofisyel pou idantite, rezidans, revni, ak lòt eleman elijibilite.",
      },
      "doc-member-forms": {
        title: "Fòmilè Manm MassHealth",
        description: "Fòmilè ofisyel pou aplikasyon, otorizasyon, mizajou, ak demann manm.",
      },
      "doc-member-guides": {
        title: "Gid ak Manyèl Manm MassHealth",
        description: "Manyèl pwogram ak dokiman gid manm MassHealth.",
      },
      "doc-hipaa-forms": {
        title: "Fòmilè HIPAA pou Manm MassHealth",
        description: "Fòmilè pou konfidansyalite ak otorizasyon pou manm ak reprezantan otorize.",
      },
    },
  },
  "pt-BR": {
    pageTitle: "Centro de Conhecimento MassHealth",
    pageDescription:
      "Veja videos, artigos e documentos oficiais do MassHealth para download.",
    languageLabel: "Idioma",
    sectionVideos: "Videos",
    sectionArticles: "Artigos",
    sectionDocuments: "Documentos",
    viewMore: "Ver mais",
    openOnYoutube: "Abrir no YouTube",
    openArticle: "Abrir Artigo",
    openSource: "Abrir Fonte",
    officialMassGov: "Mass.gov Oficial",
    sourcePage: "Pagina de origem",
    showingEnglish: "Mostrando videos oficiais em ingles para este tema.",
    translatedViaGoogle: "Traduzido pelo Google",
    documents: {
      "doc-acceptable-verifications": {
        title: "Lista de Verificações Aceitas (PDF)",
        description: "Lista oficial de verificação para identidade, residência, renda e outros itens de elegibilidade.",
      },
      "doc-member-forms": {
        title: "Formulários de Membros MassHealth",
        description: "Formulários oficiais para inscrições, autorizações, atualizações e solicitações de membros.",
      },
      "doc-member-guides": {
        title: "Guias e Manuais para Membros MassHealth",
        description: "Manuais do programa e documentos de orientação para membros do MassHealth.",
      },
      "doc-hipaa-forms": {
        title: "Formulários HIPAA para Membros MassHealth",
        description: "Formulários de privacidade e autorização para membros e representantes autorizados.",
      },
    },
  },
  es: {
    pageTitle: "Centro de Conocimiento MassHealth",
    pageDescription:
      "Consulte videos, articulos y documentos oficiales de MassHealth.",
    languageLabel: "Idioma",
    sectionVideos: "Videos",
    sectionArticles: "Articulos",
    sectionDocuments: "Documentos",
    viewMore: "Ver mas",
    openOnYoutube: "Abrir en YouTube",
    openArticle: "Abrir Articulo",
    openSource: "Abrir Fuente",
    officialMassGov: "Mass.gov Oficial",
    sourcePage: "Pagina fuente",
    showingEnglish: "Mostrando videos oficiales en ingles para este tema.",
    translatedViaGoogle: "Traducido por Google",
    documents: {
      "doc-acceptable-verifications": {
        title: "Lista de Verificaciones Aceptables (PDF)",
        description: "Lista oficial de verificación para identidad, residencia, ingresos y otros elementos de elegibilidad.",
      },
      "doc-member-forms": {
        title: "Formularios para Miembros de MassHealth",
        description: "Formularios oficiales para solicitudes, autorizaciones, actualizaciones y solicitudes de miembros.",
      },
      "doc-member-guides": {
        title: "Guías y Manuales para Miembros de MassHealth",
        description: "Manuales del programa y documentos de orientación para miembros de MassHealth.",
      },
      "doc-hipaa-forms": {
        title: "Formularios HIPAA para Miembros de MassHealth",
        description: "Formularios de privacidad y autorización para miembros y representantes autorizados.",
      },
    },
  },
  vi: {
    pageTitle: "Trung tam kien thuc MassHealth",
    pageDescription:
      "Xem video, bai viet va tai lieu chinh thuc cua MassHealth.",
    languageLabel: "Ngon ngu",
    sectionVideos: "Video",
    sectionArticles: "Bai viet",
    sectionDocuments: "Tai lieu",
    viewMore: "Xem them",
    openOnYoutube: "Mo YouTube",
    openArticle: "Mo Bai viet",
    openSource: "Mo Nguon",
    officialMassGov: "Mass.gov Chinh thuc",
    sourcePage: "Trang nguon",
    showingEnglish: "Dang hien video chinh thuc bang tieng Anh cho chu de nay.",
    translatedViaGoogle: "Dịch bởi Google",
    documents: {
      "doc-acceptable-verifications": {
        title: "Danh sách Xác minh Chấp nhận được (PDF)",
        description: "Danh sách xác minh chính thức về danh tính, nơi cư trú, thu nhập và các mục đủ điều kiện khác.",
      },
      "doc-member-forms": {
        title: "Biểu mẫu Thành viên MassHealth",
        description: "Biểu mẫu chính thức cho đơn đăng ký, ủy quyền, cập nhật và yêu cầu thành viên.",
      },
      "doc-member-guides": {
        title: "Hướng dẫn và Sổ tay Thành viên MassHealth",
        description: "Sổ tay chương trình và tài liệu hướng dẫn thành viên từ MassHealth.",
      },
      "doc-hipaa-forms": {
        title: "Biểu mẫu HIPAA cho Thành viên MassHealth",
        description: "Biểu mẫu quyền riêng tư và ủy quyền cho thành viên và đại diện được ủy quyền.",
      },
    },
  },
}

export function getKnowledgeCenterCopy(language: SupportedLanguage) {
  return KNOWLEDGE_COPY[language] ?? KNOWLEDGE_COPY.en
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function getArticlePreviewImageUrl(url: string): string {
  return `https://image.thum.io/get/width/900/noanimate/${url}`
}

export function getVideosForLanguage(language: SupportedLanguage): KnowledgeVideo[] {
  const exact = KNOWLEDGE_VIDEOS.filter((video) => video.availableLanguages.includes(language))

  if (exact.length > 0) {
    return exact
  }

  return KNOWLEDGE_VIDEOS
}

/** Maps our SupportedLanguage codes to YouTube caption language codes. */
const YOUTUBE_LANG_MAP: Record<SupportedLanguage, string> = {
  en: "en",
  "zh-CN": "zh-Hans",
  ht: "ht",
  "pt-BR": "pt",
  es: "es",
  vi: "vi",
}

/** Maps our SupportedLanguage codes to Google Translate target language codes. */
const GOOGLE_TRANSLATE_LANG_MAP: Record<SupportedLanguage, string> = {
  en: "en",
  "zh-CN": "zh-CN",
  ht: "ht",
  "pt-BR": "pt",
  es: "es",
  vi: "vi",
}

/**
 * Returns a YouTube watch URL with auto-captions enabled in the target language.
 * Falls back to the plain URL for English.
 */
export function getYouTubeUrlForLanguage(video: KnowledgeVideo, language: SupportedLanguage): string {
  if (language === "en") return video.youtubeUrl
  const ytLang = YOUTUBE_LANG_MAP[language]
  return `${video.youtubeUrl}&cc_load_policy=1&cc_lang_pref=${ytLang}`
}

/**
 * Returns a Google Translate–wrapped URL for the article when language is not English.
 * Falls back to the original URL for English.
 */
export function getArticleUrlForLanguage(article: KnowledgeArticle, language: SupportedLanguage): string {
  if (language === "en") return article.url
  const tl = GOOGLE_TRANSLATE_LANG_MAP[language]
  return `https://translate.google.com/translate?sl=en&tl=${tl}&u=${encodeURIComponent(article.url)}`
}

/**
 * Returns the language-specific document URL when available, otherwise the default English URL.
 */
export function getDocumentUrlForLanguage(document: KnowledgeDocument, language: SupportedLanguage): string {
  return document.urlByLanguage?.[language] ?? document.url
}
