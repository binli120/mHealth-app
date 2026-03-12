import { type SupportedLanguage } from "@/lib/i18n/languages"

// Types are defined in types.ts; re-exported here for backward compatibility.
export type { KnowledgeVideo, KnowledgeArticle, KnowledgeDocument } from "./types"
import type { KnowledgeVideo, KnowledgeArticle, KnowledgeDocument } from "./types"

export const KNOWLEDGE_VIDEOS: KnowledgeVideo[] = [
  {
    id: "what-is-pca",
    title: "What is a MassHealth PCA?",
    description:
      "Official MassHealth video introducing the Personal Care Attendant program.",
    youtubeId: "afD72HhNTFc",
    youtubeUrl: "https://www.youtube.com/watch?v=afD72HhNTFc",
    sourceUrl: "https://www.mass.gov/what-is-a-masshealth-pca",
    availableLanguages: ["en"],
  },
  {
    id: "claim-status",
    title: "How to check a claim status",
    description:
      "Official walkthrough for checking MassHealth claim status.",
    youtubeId: "4FR5_n_8IDg",
    youtubeUrl: "https://www.youtube.com/watch?v=4FR5_n_8IDg",
    sourceUrl: "https://www.mass.gov/info-details/how-to-check-a-masshealth-claim-status",
    availableLanguages: ["en"],
  },
  {
    id: "homeless-webinar-1",
    title: "MassHealth Application, Eligibility and Enrollment",
    description:
      "Webinar for agencies working with people experiencing homelessness.",
    youtubeId: "-6rromEb5R8",
    youtubeUrl: "https://www.youtube.com/watch?v=-6rromEb5R8",
    sourceUrl: "https://www.mass.gov/info-details/masshealth-webinars-for-homeless-providers",
    availableLanguages: ["en"],
  },
  {
    id: "homeless-webinar-2",
    title: "Webinar 2: MassHealth Long Term Services and Supports",
    description:
      "Official MassHealth webinar on long-term services and supports.",
    youtubeId: "I9KoDRwOB7k",
    youtubeUrl: "https://www.youtube.com/watch?v=I9KoDRwOB7k",
    sourceUrl: "https://www.mass.gov/info-details/masshealth-webinars-for-homeless-providers",
    availableLanguages: ["en"],
  },
  {
    id: "homeless-webinar-3",
    title: "Webinar 3: Substance Use Disorders and Addiction Services",
    description:
      "Official MassHealth webinar on substance use and addiction treatment services.",
    youtubeId: "4EE3krwQkvY",
    youtubeUrl: "https://www.youtube.com/watch?v=4EE3krwQkvY",
    sourceUrl: "https://www.mass.gov/info-details/masshealth-webinars-for-homeless-providers",
    availableLanguages: ["en"],
  },
  {
    id: "homeless-webinar-4",
    title: "MassHealth 101 Webinar Series 4 - Behavioral Health",
    description:
      "Official MassHealth webinar on behavioral health support services.",
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
    id: "changes",
    title: "Report household changes to MassHealth",
    description:
      "How to report income, address, and household updates to MassHealth.",
    url: "https://www.mass.gov/how-to/report-changes-to-masshealth",
  },
  {
    id: "contact",
    title: "Contact information for MassHealth members",
    description:
      "Official support channels and member contact information.",
    url: "https://www.mass.gov/info-details/contact-masshealth-information-for-members",
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
    id: "covered-services",
    title: "Learn about MassHealth covered services",
    description:
      "Official guidance on covered services and program differences.",
    url: "https://www.mass.gov/info-details/masshealth-covered-services",
  },
  {
    id: "apply",
    title: "Apply for MassHealth, the Health Safety Net, or CMSP",
    description:
      "Application guidance and eligibility details for major coverage pathways.",
    url: "https://www.mass.gov/how-to/apply-for-masshealth-the-health-safety-net-or-the-childrens-medical-security-plan",
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
    title: "MassHealth HIPAA Member Privacy Forms",
    description:
      "Privacy and authorization forms for members and authorized representatives.",
    url: "https://www.mass.gov/lists/masshealth-hipaa-member-privacy-forms",
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
    pageTitle: "MassHealth Zhishi Zhongxin",
    pageDescription:
      "Liulan MassHealth guanfang shipin, wenzhang he ke xiazai wenjian.",
    languageLabel: "Yuyan",
    sectionVideos: "Shipin",
    sectionArticles: "Wenzhang",
    sectionDocuments: "Wenjian",
    viewMore: "Geng duo",
    openOnYoutube: "YouTube",
    openArticle: "Dakai Wenzhang",
    openSource: "Dakai Ziyuan",
    officialMassGov: "Mass.gov Guanfang",
    sourcePage: "Laiyuan Yemi",
    showingEnglish: "Dangqian zhuti jianshi yingwen guanfang shipin.",
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
