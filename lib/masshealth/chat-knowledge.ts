import { type SupportedLanguage } from "@/lib/i18n/languages"
import type { EligibilityReport, ScreenerData } from "@/lib/eligibility-engine"
import type { ChatRole, ChatMessage, MassHealthLink, MassHealthFaqItem } from "./types"
import { MASSHEALTH_PHONE, MASSHEALTH_TTY, MASSHEALTH_SERVICE_HOURS } from "./constants"
import type { FormSection } from "./form-sections"

export type { ChatRole, ChatMessage, MassHealthLink, MassHealthFaqItem }

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
  "zh-CN": "抱歉，我只能回答与 MassHealth 相关的问题。",
  ht: "Padon, mwen ka reponn selman kestyon ki gen rapo ak MassHealth.",
  "pt-BR": "Desculpe, só posso responder perguntas relacionadas ao MassHealth.",
  es: "Lo siento, solo puedo responder preguntas relacionadas con MassHealth.",
  vi: "Xin lỗi, tôi chỉ có thể trả lời các câu hỏi liên quan đến MassHealth.",
}

const CHAT_GREETING_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: "Hi, I'm your MassHealth assistant. Ask me about eligibility, applications, renewals, covered services, documents, or appeals.",
  "zh-CN": "您好，我是您的 MassHealth 助手。您可以询问资格、申请、续保、承保服务、所需文件或申诉等问题。",
  ht: "Bonjou, mwen se asistan MassHealth ou. Mande m sou kalifikasyon, aplikasyon, renouvelman, benefis, dokiman, oswa apel.",
  "pt-BR": "Olá, sou seu assistente MassHealth. Pergunte sobre elegibilidade, inscrição, renovação, serviços cobertos, documentos ou recursos.",
  es: "Hola, soy su asistente de MassHealth. Pregunte sobre elegibilidad, solicitud, renovacion, servicios cubiertos, documentos o apelaciones.",
  vi: "Xin chào, tôi là trợ lý MassHealth của bạn. Hãy hỏi về điều kiện, nộp đơn, gia hạn, dịch vụ được chi trả, tài liệu hoặc kháng nghị.",
}

const BENEFIT_ADVISOR_GREETING_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: "Hi! I'm your MassHealth Benefit Advisor. Tell me about yourself, your household size, and your approximate income, and I'll check which programs you may qualify for.",
  "zh-CN": "您好！我是您的 MassHealth 福利顾问。请告诉我您的基本情况、家庭人数和大致收入，我会帮您查看您可能符合哪些项目。",
  ht: "Bonjou! Mwen se konseye benefis MassHealth ou. Di m kèk detay sou ou menm, kantite moun nan kay la, ak revni apeprè ou, epi m ap verifye ki pwogram ou ka kalifye pou yo.",
  "pt-BR": "Olá! Sou seu consultor de benefícios do MassHealth. Fale sobre você, o tamanho da sua família e sua renda aproximada, e eu vou verificar para quais programas você pode se qualificar.",
  es: "Hola. Soy su asesor de beneficios de MassHealth. Cuénteme sobre usted, el tamaño de su hogar y su ingreso aproximado, y revisaré para qué programas podría calificar.",
  vi: "Xin chào. Tôi là cố vấn phúc lợi MassHealth của bạn. Hãy cho tôi biết về bạn, số người trong hộ gia đình và thu nhập ước tính, rồi tôi sẽ kiểm tra những chương trình bạn có thể đủ điều kiện nhận.",
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

type LocalizedFaqCopy = Pick<MassHealthFaqItem, "id" | "question" | "quickAnswer">

const LOCALIZED_MASSHEALTH_COMMON_QUESTION_COPY: Partial<Record<SupportedLanguage, LocalizedFaqCopy[]>> = {
  "zh-CN": [
    {
      id: "apply",
      question: "我该如何申请 MassHealth 保险？",
      quickAnswer: "您可以通过 MA Login 在线申请。您也可以在同一申请流程中申请 Health Safety Net 和 CMSP 等相关项目。",
    },
    {
      id: "docs",
      question: "申请时通常需要哪些文件？",
      quickAnswer: "申请人通常需要提供社会安全号码（如有）、报税和收入信息，以及公民身份或移民身份信息。",
    },
    {
      id: "renewal",
      question: "我该如何续保 MassHealth？",
      quickAnswer: "MassHealth 需要定期续保。您可以通过官方续保渠道办理，并应尽快回应续保通知。",
    },
    {
      id: "changes",
      question: "我该如何报告收入、地址或家庭情况的变化？",
      quickAnswer: "您应尽快报告重要的家庭变化，以确保资格和福利信息保持准确。",
    },
    {
      id: "eligibility-u65",
      question: "65 岁以下成人和家庭的资格如何判定？",
      quickAnswer: "资格取决于家庭人数、年龄、残障状态以及各项目适用的收入规则等因素。",
    },
    {
      id: "eligibility-senior",
      question: "老年人或长期护理申请人的 MassHealth 规则是否不同？",
      quickAnswer: "是的。老年人和需要长期护理服务的人可能适用不同的资格路径和申请支持渠道。",
    },
    {
      id: "services",
      question: "MassHealth 覆盖哪些服务？",
      quickAnswer: "承保服务取决于您的 MassHealth 计划和资格类别。官方服务页面列出了覆盖内容和各项目具体福利。",
    },
    {
      id: "card",
      question: "我的 MassHealth 卡丢了，如何补办？",
      quickAnswer: "您可以通过 MassHealth 官方支持渠道申请补卡。部分会员会根据项目类型收到不同的保险凭证。",
    },
    {
      id: "help",
      question: "我可以在哪里获得申请帮助？",
      quickAnswer: "MassHealth 提供电话和线下帮助，包括投保协助人员以及语言支持服务。",
    },
    {
      id: "appeal",
      question: "我该如何对 MassHealth 的决定提出申诉？",
      quickAnswer: "如果您不同意某项决定，请按照通知中提供的官方申诉流程和截止日期办理。",
    },
    {
      id: "commonhealth",
      question: "什么是 MassHealth CommonHealth？",
      quickAnswer: "MassHealth CommonHealth 是为残障人士设计的项目，适用于那些可能不符合标准收入路径的人群。",
    },
  ],
  ht: [
    {
      id: "apply",
      question: "Kijan pou mwen aplike pou kouvèti MassHealth?",
      quickAnswer: "Ou ka aplike sou entènèt atravè MA Login. Ou ka aplike tou pou pwogram ki gen rapò tankou Health Safety Net ak CMSP nan menm pwosesis la.",
    },
    {
      id: "docs",
      question: "Ki dokiman mwen konn bezwen lè m ap aplike?",
      quickAnswer: "An jeneral, yo mande nimewo Sekirite Sosyal (si ou genyen youn), enfòmasyon sou taks ak revni, ansanm ak enfòmasyon sou sitwayènte oswa imigrasyon.",
    },
    {
      id: "renewal",
      question: "Kijan pou mwen renouvle kouvèti MassHealth mwen an?",
      quickAnswer: "Renouvèlman MassHealth fèt detanzantan. Ou ka renouvle atravè chanèl ofisyèl yo epi ou ta dwe reponn avi renouvèlman yo vit.",
    },
    {
      id: "changes",
      question: "Kijan pou mwen rapòte yon chanjman nan revni, adrès, oswa moun lakay mwen?",
      quickAnswer: "Ou ta dwe rapòte gwo chanjman lakay ou pi vit posib pou kalifikasyon ak benefis ou rete egzak.",
    },
    {
      id: "eligibility-u65",
      question: "Kijan yo deside kalifikasyon pou granmoun ak fanmi ki poko gen 65 an?",
      quickAnswer: "Kalifikasyon depann de gwosè kay la, laj, estati andikap, ak règ revni pou chak kategori pwogram.",
    },
    {
      id: "eligibility-senior",
      question: "Èske MassHealth diferan pou granmoun aje oswa moun k ap mande swen alontèm?",
      quickAnswer: "Wi. Granmoun aje ak moun ki bezwen sèvis swen alontèm ka gen chemen kalifikasyon ak sipò aplikasyon ki diferan.",
    },
    {
      id: "services",
      question: "Ki sèvis MassHealth kouvri?",
      quickAnswer: "Sèvis yo depann de plan MassHealth ou ak kategori kalifikasyon ou. Paj ofisyèl yo montre sèvis ki kouvri ak benefis espesifik yo.",
    },
    {
      id: "card",
      question: "Kijan pou mwen ranplase yon kat MassHealth mwen pèdi?",
      quickAnswer: "Ou ka mande yon kat ranplasman atravè resous sipò MassHealth yo. Gen kèk manm ki resevwa lòt kalite dokiman selon pwogram yo.",
    },
    {
      id: "help",
      question: "Ki kote mwen ka jwenn èd pou aplikasyon mwen an?",
      quickAnswer: "MassHealth ofri èd pa telefòn ak an pèsòn, tankou asistan enskripsyon ak sèvis sipò lang.",
    },
    {
      id: "appeal",
      question: "Kijan pou mwen fè apèl kont yon desizyon MassHealth?",
      quickAnswer: "Si ou pa dakò ak yon desizyon, swiv pwosesis apèl ofisyèl la ak dat limit ki ekri nan avi ou a.",
    },
    {
      id: "commonhealth",
      question: "Kisa MassHealth CommonHealth ye?",
      quickAnswer: "MassHealth CommonHealth se yon pwogram pou moun ki gen andikap ki ka pa kalifye anba règ revni nòmal yo.",
    },
  ],
  "pt-BR": [
    {
      id: "apply",
      question: "Como faço para solicitar cobertura do MassHealth?",
      quickAnswer: "Você pode solicitar online pelo MA Login. Também pode solicitar programas relacionados, como Health Safety Net e CMSP, no mesmo fluxo.",
    },
    {
      id: "docs",
      question: "Quais documentos eu normalmente preciso ao solicitar?",
      quickAnswer: "Normalmente pedem número do Social Security (se disponível), informações de renda e impostos, além de dados de cidadania ou imigração.",
    },
    {
      id: "renewal",
      question: "Como faço para renovar minha cobertura do MassHealth?",
      quickAnswer: "As renovações do MassHealth acontecem periodicamente. Você pode renovar pelos canais oficiais e deve responder rapidamente aos avisos de renovação.",
    },
    {
      id: "changes",
      question: "Como informo mudança de renda, endereço ou composição familiar?",
      quickAnswer: "Você deve informar mudanças importantes na família o quanto antes para manter a elegibilidade e os benefícios corretos.",
    },
    {
      id: "eligibility-u65",
      question: "Como a elegibilidade é decidida para adultos e famílias com menos de 65 anos?",
      quickAnswer: "A elegibilidade depende de fatores como tamanho da família, idade, deficiência e regras de renda de cada categoria de programa.",
    },
    {
      id: "eligibility-senior",
      question: "O MassHealth é diferente para idosos ou para quem solicita cuidados de longo prazo?",
      quickAnswer: "Sim. Idosos e pessoas que precisam de cuidados de longo prazo podem ter caminhos de elegibilidade e apoio à inscrição diferentes.",
    },
    {
      id: "services",
      question: "Quais serviços o MassHealth cobre?",
      quickAnswer: "Os serviços cobertos dependem do seu plano MassHealth e da sua categoria de elegibilidade. As páginas oficiais mostram os benefícios cobertos por programa.",
    },
    {
      id: "card",
      question: "Como substituo um cartão MassHealth perdido?",
      quickAnswer: "Você pode pedir um cartão de reposição pelos recursos oficiais de suporte do MassHealth. Alguns membros recebem documentos diferentes conforme o programa.",
    },
    {
      id: "help",
      question: "Onde posso obter ajuda com minha solicitação?",
      quickAnswer: "O MassHealth oferece ajuda por telefone e presencialmente, incluindo assistentes de inscrição e serviços de apoio em outros idiomas.",
    },
    {
      id: "appeal",
      question: "Como faço para recorrer de uma decisão do MassHealth?",
      quickAnswer: "Se você discordar de uma decisão, siga o processo oficial de recurso e os prazos informados no seu aviso.",
    },
    {
      id: "commonhealth",
      question: "O que é o MassHealth CommonHealth?",
      quickAnswer: "O MassHealth CommonHealth é um programa voltado para pessoas com deficiência que talvez não se qualifiquem pelas regras padrão de renda.",
    },
  ],
  es: [
    {
      id: "apply",
      question: "¿Cómo solicito la cobertura de MassHealth?",
      quickAnswer: "Puede solicitarla en línea por medio de MA Login. También puede solicitar programas relacionados, como Health Safety Net y CMSP, en el mismo proceso.",
    },
    {
      id: "docs",
      question: "¿Qué documentos normalmente necesito al solicitar?",
      quickAnswer: "Por lo general le pedirán número de Seguro Social (si lo tiene), información de impuestos e ingresos, y datos de ciudadanía o inmigración.",
    },
    {
      id: "renewal",
      question: "¿Cómo renuevo mi cobertura de MassHealth?",
      quickAnswer: "Las renovaciones de MassHealth son periódicas. Puede renovar por los canales oficiales y debe responder con rapidez a los avisos de renovación.",
    },
    {
      id: "changes",
      question: "¿Cómo reporto un cambio de ingresos, dirección o hogar?",
      quickAnswer: "Debe reportar los cambios importantes del hogar lo antes posible para que su elegibilidad y beneficios sigan siendo correctos.",
    },
    {
      id: "eligibility-u65",
      question: "¿Cómo se decide la elegibilidad para adultos y familias menores de 65 años?",
      quickAnswer: "La elegibilidad depende de factores como el tamaño del hogar, la edad, la discapacidad y las reglas de ingresos de cada programa.",
    },
    {
      id: "eligibility-senior",
      question: "¿MassHealth es diferente para personas mayores o solicitantes de cuidado a largo plazo?",
      quickAnswer: "Sí. Las personas mayores y quienes necesitan servicios de cuidado a largo plazo pueden tener vías de elegibilidad y apoyo de solicitud diferentes.",
    },
    {
      id: "services",
      question: "¿Qué servicios cubre MassHealth?",
      quickAnswer: "Los servicios cubiertos dependen de su plan de MassHealth y su categoría de elegibilidad. Las páginas oficiales muestran los beneficios cubiertos y específicos del programa.",
    },
    {
      id: "card",
      question: "¿Cómo reemplazo una tarjeta de MassHealth perdida?",
      quickAnswer: "Puede solicitar una tarjeta de reemplazo mediante los recursos oficiales de MassHealth. Algunos miembros reciben documentación distinta según su programa.",
    },
    {
      id: "help",
      question: "¿Dónde puedo obtener ayuda con mi solicitud?",
      quickAnswer: "MassHealth ofrece ayuda por teléfono y en persona, incluidos asistentes de inscripción y servicios de apoyo en otros idiomas.",
    },
    {
      id: "appeal",
      question: "¿Cómo apelo una decisión de MassHealth?",
      quickAnswer: "Si no está de acuerdo con una decisión, siga el proceso oficial de apelación y los plazos indicados en su aviso.",
    },
    {
      id: "commonhealth",
      question: "¿Qué es MassHealth CommonHealth?",
      quickAnswer: "MassHealth CommonHealth es un programa diseñado para personas con discapacidades que quizá no califiquen bajo las reglas estándar basadas en ingresos.",
    },
  ],
  vi: [
    {
      id: "apply",
      question: "Tôi nộp đơn xin bảo hiểm MassHealth như thế nào?",
      quickAnswer: "Bạn có thể nộp đơn trực tuyến qua MA Login. Bạn cũng có thể nộp cho các chương trình liên quan như Health Safety Net và CMSP trong cùng quy trình.",
    },
    {
      id: "docs",
      question: "Khi nộp đơn tôi thường cần những giấy tờ gì?",
      quickAnswer: "Người nộp đơn thường được yêu cầu cung cấp số An sinh Xã hội (nếu có), thông tin thuế và thu nhập, cùng thông tin về quốc tịch hoặc di trú.",
    },
    {
      id: "renewal",
      question: "Tôi gia hạn bảo hiểm MassHealth như thế nào?",
      quickAnswer: "MassHealth yêu cầu gia hạn định kỳ. Bạn có thể gia hạn qua các kênh chính thức và nên phản hồi nhanh các thông báo gia hạn.",
    },
    {
      id: "changes",
      question: "Tôi báo thay đổi về thu nhập, địa chỉ hoặc hộ gia đình như thế nào?",
      quickAnswer: "Bạn nên báo các thay đổi quan trọng trong hộ gia đình càng sớm càng tốt để điều kiện và quyền lợi luôn chính xác.",
    },
    {
      id: "eligibility-u65",
      question: "Điều kiện cho người lớn và gia đình dưới 65 tuổi được xác định như thế nào?",
      quickAnswer: "Điều kiện phụ thuộc vào các yếu tố như số người trong hộ, tuổi, tình trạng khuyết tật và quy định về thu nhập của từng chương trình.",
    },
    {
      id: "eligibility-senior",
      question: "MassHealth có khác cho người cao tuổi hoặc người xin dịch vụ chăm sóc dài hạn không?",
      quickAnswer: "Có. Người cao tuổi và người cần dịch vụ chăm sóc dài hạn có thể có lộ trình điều kiện và hỗ trợ nộp đơn khác nhau.",
    },
    {
      id: "services",
      question: "MassHealth chi trả những dịch vụ nào?",
      quickAnswer: "Dịch vụ được chi trả phụ thuộc vào gói MassHealth và nhóm điều kiện của bạn. Các trang chính thức liệt kê quyền lợi được chi trả theo từng chương trình.",
    },
    {
      id: "card",
      question: "Tôi thay thẻ MassHealth bị mất như thế nào?",
      quickAnswer: "Bạn có thể yêu cầu cấp lại thẻ qua các kênh hỗ trợ chính thức của MassHealth. Một số thành viên sẽ nhận giấy tờ bảo hiểm khác tùy chương trình.",
    },
    {
      id: "help",
      question: "Tôi có thể nhận trợ giúp cho hồ sơ của mình ở đâu?",
      quickAnswer: "MassHealth cung cấp hỗ trợ qua điện thoại và trực tiếp, bao gồm nhân viên hỗ trợ ghi danh và dịch vụ hỗ trợ ngôn ngữ.",
    },
    {
      id: "appeal",
      question: "Tôi kháng nghị quyết định của MassHealth như thế nào?",
      quickAnswer: "Nếu bạn không đồng ý với một quyết định, hãy làm theo quy trình kháng nghị chính thức và thời hạn ghi trong thông báo của bạn.",
    },
    {
      id: "commonhealth",
      question: "MassHealth CommonHealth là gì?",
      quickAnswer: "MassHealth CommonHealth là chương trình dành cho người khuyết tật, những người có thể không đủ điều kiện theo lộ trình tiêu chuẩn dựa trên thu nhập.",
    },
  ],
}

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

export function getBenefitAdvisorGreeting(language: SupportedLanguage): string {
  return BENEFIT_ADVISOR_GREETING_BY_LANGUAGE[language] ?? BENEFIT_ADVISOR_GREETING_BY_LANGUAGE.en
}

export function getMassHealthCommonQuestions(language: SupportedLanguage): MassHealthFaqItem[] {
  const localizedQuestions = LOCALIZED_MASSHEALTH_COMMON_QUESTION_COPY[language]
  if (!localizedQuestions || localizedQuestions.length === 0) {
    return MASSHEALTH_COMMON_QUESTIONS
  }

  const localizedById = new Map(
    localizedQuestions.map((faq) => [faq.id, faq] as const),
  )

  return MASSHEALTH_COMMON_QUESTIONS.map((faq) => {
    const localized = localizedById.get(faq.id)
    if (!localized) return faq

    return {
      ...faq,
      question: localized.question,
      quickAnswer: localized.quickAnswer,
    }
  })
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
    `MassHealth Customer Service Center: ${MASSHEALTH_PHONE}, TTY: ${MASSHEALTH_TTY}`,
    `Self-service is available 24/7 in English and Spanish. Live services are typically ${MASSHEALTH_SERVICE_HOURS}.`,
  ].join("\n")
}

export function buildMassHealthIntakeSystemPrompt(
  language: SupportedLanguage,
  applicationType?: string,
): string {
  const responseLanguage = LANGUAGE_RESPONSE_HINT[language] ?? LANGUAGE_RESPONSE_HINT.en
  const normalizedApplicationType = (applicationType ?? "").trim()
  const applicationTypeHint = normalizedApplicationType
    ? `Application type selected by the user: ${normalizedApplicationType}.`
    : "Application type is not specified yet."

  return [
    "You are a MassHealth application intake assistant.",
    "Goal: collect structured details needed for a MassHealth application through natural conversation.",
    "Rules:",
    "1) Ask one focused follow-up question at a time.",
    "2) Accept plain language responses and summarize what was captured.",
    "3) If information is missing, ask for the missing detail directly.",
    "4) Keep responses concise and supportive.",
    `5) Respond in ${responseLanguage}.`,
    "6) Stay within MassHealth application intake scope.",
    "7) Do not ask for details already explicitly provided by the user in this conversation.",
    "8) Infer household relationship when the user states it in plain language.",
    "9) If user says phrases like 'my wife Susan', 'my husband John', 'my son Alex', or 'my daughter Mia', treat relationship as already known and ask only for remaining missing data (for example date of birth).",
    "",
    applicationTypeHint,
    "Key intake domains to collect:",
    "- Applicant identity and contact info",
    "- Household members and relationships",
    "- Income sources and frequency",
    "- Current health coverage and tax filing status",
    "- Citizenship or immigration details when relevant",
    "",
    "If the user asks for policy specifics, provide official MassHealth references and suggest verifying with MassHealth support.",
  ].join("\n")
}

// ── RAG-augmented prompt builders (new) ───────────────────────────────────────

/**
 * Build the assistant system prompt with dynamically retrieved policy context
 * from the RAG vector store, replacing the static FAQ block.
 *
 * Falls back gracefully to the static FAQ when ragContext is empty.
 */
export function buildMassHealthSystemPromptWithContext(
  language: SupportedLanguage,
  ragContext: string,
): string {
  if (!ragContext.trim()) {
    // No RAG context available — use the existing static prompt as-is
    return buildMassHealthSystemPrompt(language)
  }

  const outOfScopeResponse = getMassHealthOutOfScopeResponse(language)
  const responseLanguage = LANGUAGE_RESPONSE_HINT[language] ?? LANGUAGE_RESPONSE_HINT.en

  return [
    "You are a MassHealth-only virtual assistant.",
    "Follow these rules strictly:",
    "1) Answer only questions related to MassHealth programs, eligibility, enrollment, renewal, benefits, and member services.",
    `2) If the question is outside this scope, respond exactly with: ${outOfScopeResponse}`,
    "3) Ground your answers in the policy references provided below. Do not invent thresholds or rules not present in these references.",
    "4) Keep answers concise, practical, and clear. Include official links when relevant.",
    "5) Mention this is informational support and users should verify final decisions with MassHealth.",
    `6) Respond in ${responseLanguage}.`,
    "",
    "Relevant MassHealth policy references (retrieved from official documents):",
    ragContext,
    "",
    "MassHealth support contact:",
    `MassHealth Customer Service Center: ${MASSHEALTH_PHONE}, TTY: ${MASSHEALTH_TTY}`,
    `Self-service is available 24/7 in English and Spanish. Live services are typically ${MASSHEALTH_SERVICE_HOURS}.`,
  ].join("\n")
}

/**
 * Build the system prompt for the benefit_advisor chat mode.
 *
 * When eligibilityResults is provided (facts were sufficient for evaluation),
 * the prompt instructs the LLM to explain results and next steps.
 *
 * When eligibilityResults is null (still collecting facts), the prompt
 * instructs the LLM to ask for the next missing piece of information
 * in a friendly, conversational way.
 */
export function buildBenefitAdvisorSystemPrompt(
  language: SupportedLanguage,
  facts: Partial<ScreenerData>,
  eligibilityResults: EligibilityReport | null,
  ragContext: string,
): string {
  const responseLanguage = LANGUAGE_RESPONSE_HINT[language] ?? LANGUAGE_RESPONSE_HINT.en

  const factsSection = buildFactsSummary(facts)

  if (eligibilityResults) {
    // ── Full evaluation mode ───────────────────────────────────────────────
    const resultsSummary = buildResultsSummary(eligibilityResults)

    return [
      "You are a MassHealth and public benefits advisor.",
      "The eligibility rule engine has evaluated this user's situation. Your job is to EXPLAIN",
      "the results clearly in plain language — do NOT re-evaluate or override these results.",
      "",
      "Rules:",
      "1) Explain each program result in plain language — what it is, why they qualify, and how much it's worth.",
      "2) Highlight the most actionable next step (what to apply for first).",
      "3) Mention relevant documents or requirements from the results.",
      "4) Cite the policy references below when relevant (e.g. 'according to the MassHealth Member Booklet...').",
      "5) Close with: 'These estimates are based on your responses. Contact MassHealth at (800) 841-2900 for official determination.'",
      `6) Respond in ${responseLanguage}.`,
      "",
      factsSection,
      "",
      "Eligibility rule engine results (authoritative — do not modify):",
      resultsSummary,
      ragContext ? "\nSupporting policy references:" : "",
      ragContext,
    ].filter(Boolean).join("\n")
  }

  // ── Fact-gathering mode ────────────────────────────────────────────────────
  const missingFields = getMissingRequiredFields(facts)

  return [
    "You are a friendly MassHealth benefits advisor.",
    "You are helping a user find out what health and social services programs they qualify for.",
    "You are collecting a few facts to run an eligibility estimate.",
    "",
    "Rules:",
    "1) Ask for ONLY ONE missing piece of information per message. Be conversational and warm.",
    "2) Do not ask for information already listed in the facts below.",
    "3) Do not make eligibility determinations yet — just collect the missing facts.",
    "4) If the user asks a policy question, answer briefly using the references below, then return to collecting facts.",
    `5) Respond in ${responseLanguage}.`,
    "",
    factsSection,
    missingFields.length > 0
      ? `\nNext fact to collect: ${missingFields[0]} — ask for this now, conversationally.`
      : "\nAll required facts collected — the rule engine will evaluate in the next step.",
    ragContext ? "\nMassHealth policy references for context:" : "",
    ragContext,
  ].filter(Boolean).join("\n")
}

// ── Helpers for prompt builders ───────────────────────────────────────────────

function buildFactsSummary(facts: Partial<ScreenerData>): string {
  if (Object.keys(facts).length === 0) {
    return "User facts: None collected yet."
  }

  const lines = ["User facts (extracted from conversation):"]
  if (facts.livesInMA !== undefined) lines.push(`  - Lives in MA: ${facts.livesInMA ? "Yes" : "No"}`)
  if (facts.age !== undefined) lines.push(`  - Age: ${facts.age}`)
  if (facts.householdSize !== undefined) lines.push(`  - Household size: ${facts.householdSize}`)
  if (facts.annualIncome !== undefined) lines.push(`  - Annual income: $${facts.annualIncome.toLocaleString()}`)
  if (facts.isPregnant) lines.push("  - Pregnant: Yes")
  if (facts.hasDisability) lines.push("  - Has documented disability / SSI / SSDI: Yes")
  if (facts.hasMedicare) lines.push("  - Has Medicare: Yes")
  if (facts.hasEmployerInsurance) lines.push("  - Has employer insurance: Yes")
  if (facts.citizenshipStatus) lines.push(`  - Citizenship: ${facts.citizenshipStatus}`)

  return lines.join("\n")
}

function buildResultsSummary(report: EligibilityReport): string {
  const lines: string[] = [
    `FPL: ${report.fplPercent}% (Annual FPL for this household: $${report.annualFPL.toLocaleString()})`,
  ]

  for (const result of report.results) {
    lines.push(`\nProgram: ${result.program}`)
    lines.push(`  Status: ${result.status}`)
    lines.push(`  ${result.tagline}`)
    lines.push(`  ${result.details.slice(0, 300)}`)
    lines.push(`  Apply: ${result.actionHref}`)
  }

  return lines.join("\n")
}

// ── Form Assistant prompt builder ─────────────────────────────────────────────

const FORM_SECTION_LABELS: Record<FormSection, string> = {
  personal: "Personal Information (name, date of birth)",
  contact: "Contact Details (email, phone, address)",
  household: "Household Members",
  income: "Income Sources",
  documents: "Supporting Documents",
}

const FORM_SECTION_NEXT_FIELDS: Record<FormSection, string> = {
  personal: "Ask for the applicant's first name, last name, and date of birth (MM/DD/YYYY). Ask one at a time if not already provided.",
  contact: "Ask for the applicant's email address, phone number, and home address (street, city, state, ZIP). Ask one at a time.",
  household: "Ask if anyone else lives in the household. If yes, collect first name, last name, their relationship TO THE APPLICANT (e.g. spouse, child, parent, sibling), and date of birth for each person — one question at a time. IMPORTANT: if a member's relationship is already listed in the collected data below, do NOT ask for it again. When all members are captured, confirm the complete list and move on.",
  income: "Ask about sources of income for the applicant and all household members. Accept any format (job, SSI, child support, etc.). When done (or if they have none), confirm.",
  documents: "All form data collected! Let the user know they can now upload supporting documents like proof of income and ID using the upload section on the right. Ask if they have any other questions.",
}

/**
 * Build the system prompt for form_assistant mode.
 * Section-aware: guides the LLM through collecting fields in sequence.
 * Supports mid-fill policy Q&A via optional RAG context.
 */
export function buildFormAssistantSystemPrompt(
  language: SupportedLanguage,
  collectedSummary: string,
  currentSection: FormSection,
  ragContext?: string,
): string {
  const responseLanguage = LANGUAGE_RESPONSE_HINT[language] ?? LANGUAGE_RESPONSE_HINT.en
  const sectionLabel = FORM_SECTION_LABELS[currentSection]
  const nextFieldsHint = FORM_SECTION_NEXT_FIELDS[currentSection]

  const sections = [
    "You are a friendly, patient MassHealth application assistant.",
    "You are helping a user complete their MassHealth health coverage application through natural conversation.",
    "Your goal: collect application form data one section at a time in a warm, conversational tone.",
    "",
    "Rules:",
    "1) Focus on the CURRENT SECTION shown below. Complete it before moving on.",
    "2) Ask ONE question at a time. Never ask for multiple pieces of info in one message.",
    "3) After the user provides information, briefly confirm it in second person — address the user as 'you', not by name.",
    "   Good: 'Got it — I have your date of birth as 01/15/1990.'",
    "   Bad:  'Got it — David Ho, born 01/15/1990.' (never refer to the applicant in third person)",
    "4) If the user asks a policy question (why we need certain info, what counts as income, etc.),",
    "   answer it briefly and clearly, then return to collecting the next field.",
    "5) Do not ask for information already collected (listed in 'Data already collected' below).",
    "   This applies to household members too — if a member already appears with their relationship, skip those questions.",
    "6) Do not ask for Social Security Number — that will be collected securely in a separate step.",
    "7) Keep responses under 3 sentences unless explaining policy.",
    `8) Respond in ${responseLanguage}.`,
    "9) Be encouraging and reassure users that their information is secure.",
    "",
    `Current section: ${sectionLabel}`,
    `What to do now: ${nextFieldsHint}`,
    "",
    "Data already collected (do not ask for these again):",
    collectedSummary || "Nothing yet — start from the beginning.",
  ]

  if (ragContext) {
    sections.push(
      "",
      "MassHealth policy references (use when answering policy questions mid-fill):",
      ragContext,
    )
  }

  return sections.join("\n")
}

const FORM_ASSISTANT_GREETING_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: "Hi! I'm your HealthCompass MA application assistant. I'll guide you through your MassHealth application step by step — it usually takes about 5 minutes. Let's start with your name. What's your first name?",
  "zh-CN": "您好！我是您的 HealthCompass MA 申请助手。我将一步步引导您完成 MassHealth 申请，通常只需约5分钟。我们先从您的姓名开始。请问您的名字（名）是什么？",
  ht: "Bonjou! Mwen se asistan aplikasyon HealthCompass MA ou. M ap gide ou etap pa etap pou ranpli aplikasyon MassHealth ou a — sa pran anviron 5 minit. Ann kòmanse ak non ou. Ki prenon ou?",
  "pt-BR": "Olá! Sou seu assistente de inscrição HealthCompass MA. Vou te guiar passo a passo pelo seu pedido MassHealth — geralmente leva cerca de 5 minutos. Vamos começar com seu nome. Qual é o seu primeiro nome?",
  es: "¡Hola! Soy su asistente de solicitud HealthCompass MA. Le guiaré paso a paso a través de su solicitud MassHealth, lo cual suele tomar unos 5 minutos. Empecemos con su nombre. ¿Cuál es su nombre?",
  vi: "Xin chào! Tôi là trợ lý nộp đơn HealthCompass MA của bạn. Tôi sẽ hướng dẫn bạn từng bước để hoàn thành đơn xin MassHealth — thường mất khoảng 5 phút. Hãy bắt đầu với tên của bạn. Tên của bạn là gì?",
}

export function getFormAssistantGreeting(language: SupportedLanguage): string {
  return FORM_ASSISTANT_GREETING_BY_LANGUAGE[language] ?? FORM_ASSISTANT_GREETING_BY_LANGUAGE.en
}

// ── Helpers for prompt builders ───────────────────────────────────────────────

function getMissingRequiredFields(facts: Partial<ScreenerData>): string[] {
  const missing: string[] = []
  if (facts.livesInMA === undefined) missing.push("whether they live in Massachusetts")
  if (facts.age === undefined) missing.push("their age")
  if (facts.householdSize === undefined) missing.push("how many people are in their household")
  if (facts.annualIncome === undefined) missing.push("their approximate annual household income")
  return missing
}
