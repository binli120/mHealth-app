/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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
