/**
 * Localised copy for the MassHealth Chat Widget.
 *
 * Structure mirrors lib/i18n/messages.ts:
 *   - EN_CHAT_WIDGET  — canonical English strings (source of truth / fallback)
 *   - One const per locale with only the keys that differ from English
 *   - CHAT_WIDGET_CATALOG  — assembled Record<SupportedLanguage, ChatWidgetCopy>
 *   - getChatWidgetCopy(lang) — public accessor with English fallback
 *
 * To add a new locale: add it to SUPPORTED_LANGUAGES, then add a new const
 * here following the pattern below and add it to CHAT_WIDGET_CATALOG.
 *
 * To add a new string key: add it to EN_CHAT_WIDGET first (the type is
 * derived from that object), then translate it in every locale block.
 *
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { type SupportedLanguage } from "@/lib/i18n/languages"

// ── Shape ─────────────────────────────────────────────────────────────────────

/**
 * All UI strings used by MassHealthChatWidget.
 * Keys are derived from EN_CHAT_WIDGET (adding a key there automatically
 * requires it everywhere), but values are widened to `string` so that
 * per-locale overrides can assign any translated string without TypeScript
 * complaining that e.g. "关闭" is not assignable to literal "Close".
 */
export type ChatWidgetCopy = { [K in keyof typeof EN_CHAT_WIDGET]: string }

/** Union of all valid copy keys — useful for exhaustive tests. */
export type ChatWidgetCopyKey = keyof ChatWidgetCopy

// ── English baseline ──────────────────────────────────────────────────────────

const EN_CHAT_WIDGET = {
  // Floating button
  openAssistant:     "Open MassHealth assistant",
  hideAssistant:     "Hide MassHealth assistant",

  // Dialog
  dialogLabel:       "MassHealth AI Assistant",
  title:             "MassHealth AI Assistant",
  languagePlaceholder: "Language",
  close:             "Close",

  // Description shown under the title
  advisorDescription:
    "Tell me about your situation and I'll check eligibility using official MassHealth rules.",
  chatDescription:
    "MassHealth-only support. Ask about eligibility, applications, renewals, and benefits.",

  // Tab labels
  advisorTab:        "Benefit Advisor",
  faqTab:            "Common Questions",
  chatTab:           "Chat",
  reset:             "Reset",

  // FAQ view
  faqHint:           "Pick a common question below or switch to Chat to type your own.",
  chatAboutThis:     "Chat about this",
  officialSource:    "Official source",

  // Advisor banner
  advisorDisclaimer:
    "Eligibility determined by rule engine — LLM explains, never decides.",

  // Loading indicators
  checkingEligibility: "Checking eligibility…",
  thinking:            "Thinking…",

  // Input placeholders
  advisorPlaceholder: "Tell me your age, household size, and income…",
  chatPlaceholder:    "Ask a MassHealth question…",
  send:               "Send",

  // Out-of-scope footer hint
  outOfTopicLabel:   "Out-of-topic prompts get:",

  // Error / fallback messages (also used as system message content)
  fallbackReply:
    "I couldn't complete that request. Please try again, or call MassHealth at (800) 841-2900.",
  serviceUnavailable:
    "I couldn't reach the local AI service. Confirm Ollama is running.",
} as const satisfies Record<string, string>

// ── Per-locale overrides ──────────────────────────────────────────────────────
// Only keys that differ from EN_CHAT_WIDGET need to be present in each block.
// The type annotation `Partial<ChatWidgetCopy>` enforces that no new keys are
// introduced and all values remain strings.

const ZH_CN_CHAT_WIDGET: Partial<ChatWidgetCopy> = {
  openAssistant:       "打开 MassHealth 助手",
  hideAssistant:       "隐藏 MassHealth 助手",
  dialogLabel:         "MassHealth AI 助手",
  title:               "MassHealth AI 助手",
  languagePlaceholder: "语言",
  close:               "关闭",
  advisorDescription:  "请告诉我您的情况，我会根据官方 MassHealth 规则帮您检查资格。",
  chatDescription:     "仅限 MassHealth 支持。您可以询问资格、申请、续保和福利。",
  advisorTab:          "福利顾问",
  faqTab:              "常见问题",
  chatTab:             "聊天",
  reset:               "重置",
  faqHint:             "请从下面选择一个常见问题，或切换到聊天自行输入。",
  chatAboutThis:       "继续聊这个问题",
  officialSource:      "官方来源",
  advisorDisclaimer:   "资格由规则引擎判定，LLM 只负责解释，不负责决定。",
  checkingEligibility: "正在检查资格…",
  thinking:            "正在思考…",
  advisorPlaceholder:  "请输入您的年龄、家庭人数和收入…",
  chatPlaceholder:     "请输入一个 MassHealth 问题…",
  send:                "发送",
  outOfTopicLabel:     "超出范围的问题将得到：",
  fallbackReply:       "我无法完成该请求。请重试，或致电 MassHealth：(800) 841-2900。",
  serviceUnavailable:  "我无法连接到本地 AI 服务。请确认 Ollama 正在运行。",
}

const HT_CHAT_WIDGET: Partial<ChatWidgetCopy> = {
  openAssistant:       "Louvri asistan MassHealth la",
  hideAssistant:       "Kache asistan MassHealth la",
  dialogLabel:         "Asistan AI MassHealth",
  title:               "Asistan AI MassHealth",
  languagePlaceholder: "Lang",
  close:               "Fèmen",
  advisorDescription:
    "Di m sitiyasyon ou epi m ap verifye kalifikasyon ou dapre règ ofisyèl MassHealth yo.",
  chatDescription:
    "Sipò pou MassHealth sèlman. Poze kestyon sou kalifikasyon, aplikasyon, renouvèlman ak benefis.",
  advisorTab:          "Konseye Benefis",
  faqTab:              "Kestyon Komen",
  reset:               "Rekòmanse",
  faqHint:             "Chwazi yon kestyon komen anba a oswa chanje pou Chat pou ekri pa w.",
  chatAboutThis:       "Pale sou sa",
  officialSource:      "Sous ofisyèl",
  advisorDisclaimer:   "Motè règ la detèmine kalifikasyon an; LLM nan sèlman esplike li.",
  checkingEligibility: "Ap verifye kalifikasyon…",
  thinking:            "Ap reflechi…",
  advisorPlaceholder:  "Di m laj ou, kantite moun nan kay la, ak revni ou…",
  chatPlaceholder:     "Poze yon kestyon sou MassHealth…",
  send:                "Voye",
  outOfTopicLabel:     "Pou kestyon ki pa nan sijè a, repons lan se:",
  fallbackReply:
    "M pa t ka fini demann sa a. Tanpri eseye ankò, oswa rele MassHealth nan (800) 841-2900.",
  serviceUnavailable:  "M pa t ka konekte ak sèvis AI lokal la. Verifye Ollama ap mache.",
}

const PT_BR_CHAT_WIDGET: Partial<ChatWidgetCopy> = {
  openAssistant:       "Abrir assistente do MassHealth",
  hideAssistant:       "Ocultar assistente do MassHealth",
  dialogLabel:         "Assistente de IA do MassHealth",
  title:               "Assistente de IA do MassHealth",
  languagePlaceholder: "Idioma",
  close:               "Fechar",
  advisorDescription:
    "Conte sua situação e eu vou verificar a elegibilidade usando as regras oficiais do MassHealth.",
  chatDescription:
    "Suporte apenas para MassHealth. Pergunte sobre elegibilidade, inscrição, renovação e benefícios.",
  advisorTab:          "Consultor de Benefícios",
  faqTab:              "Perguntas Frequentes",
  reset:               "Reiniciar",
  faqHint:             "Escolha uma pergunta comum abaixo ou mude para o chat para digitar a sua.",
  chatAboutThis:       "Conversar sobre isso",
  officialSource:      "Fonte oficial",
  advisorDisclaimer:   "A elegibilidade é determinada pelo motor de regras; o LLM apenas explica.",
  checkingEligibility: "Verificando elegibilidade…",
  thinking:            "Pensando…",
  advisorPlaceholder:  "Informe sua idade, o tamanho da família e a renda…",
  chatPlaceholder:     "Faça uma pergunta sobre o MassHealth…",
  send:                "Enviar",
  outOfTopicLabel:     "Perguntas fora do tema recebem:",
  fallbackReply:
    "Não consegui concluir essa solicitação. Tente novamente ou ligue para o MassHealth em (800) 841-2900.",
  serviceUnavailable:
    "Não consegui acessar o serviço local de IA. Confirme que o Ollama está em execução.",
}

const ES_CHAT_WIDGET: Partial<ChatWidgetCopy> = {
  openAssistant:       "Abrir asistente de MassHealth",
  hideAssistant:       "Ocultar asistente de MassHealth",
  dialogLabel:         "Asistente de IA de MassHealth",
  title:               "Asistente de IA de MassHealth",
  languagePlaceholder: "Idioma",
  close:               "Cerrar",
  advisorDescription:
    "Cuénteme su situación y revisaré su elegibilidad usando las reglas oficiales de MassHealth.",
  chatDescription:
    "Soporte solo para MassHealth. Pregunte sobre elegibilidad, solicitudes, renovaciones y beneficios.",
  advisorTab:          "Asesor de Beneficios",
  faqTab:              "Preguntas Comunes",
  reset:               "Restablecer",
  faqHint:             "Elija una pregunta común abajo o cambie a Chat para escribir la suya.",
  chatAboutThis:       "Hablar de esto",
  officialSource:      "Fuente oficial",
  advisorDisclaimer:   "La elegibilidad la determina el motor de reglas; el LLM solo la explica.",
  checkingEligibility: "Revisando elegibilidad…",
  thinking:            "Pensando…",
  advisorPlaceholder:  "Dígame su edad, el tamaño de su hogar y sus ingresos…",
  chatPlaceholder:     "Haga una pregunta sobre MassHealth…",
  send:                "Enviar",
  outOfTopicLabel:     "Las preguntas fuera del tema reciben:",
  fallbackReply:
    "No pude completar esa solicitud. Inténtelo de nuevo o llame a MassHealth al (800) 841-2900.",
  serviceUnavailable:
    "No pude conectarme al servicio local de IA. Confirme que Ollama esté en ejecución.",
}

const VI_CHAT_WIDGET: Partial<ChatWidgetCopy> = {
  openAssistant:       "Mở trợ lý MassHealth",
  hideAssistant:       "Ẩn trợ lý MassHealth",
  dialogLabel:         "Trợ lý AI MassHealth",
  title:               "Trợ lý AI MassHealth",
  languagePlaceholder: "Ngôn ngữ",
  close:               "Đóng",
  advisorDescription:
    "Hãy cho tôi biết tình hình của bạn và tôi sẽ kiểm tra điều kiện theo các quy định chính thức của MassHealth.",
  chatDescription:
    "Chỉ hỗ trợ về MassHealth. Hãy hỏi về điều kiện, nộp đơn, gia hạn và quyền lợi.",
  advisorTab:          "Tư Vấn Phúc Lợi",
  faqTab:              "Câu Hỏi Thường Gặp",
  reset:               "Đặt lại",
  faqHint:             "Chọn một câu hỏi phổ biến bên dưới hoặc chuyển sang Chat để tự nhập câu hỏi.",
  chatAboutThis:       "Trao đổi về mục này",
  officialSource:      "Nguồn chính thức",
  advisorDisclaimer:   "Điều kiện do bộ quy tắc xác định; LLM chỉ giải thích, không quyết định.",
  checkingEligibility: "Đang kiểm tra điều kiện…",
  thinking:            "Đang suy nghĩ…",
  advisorPlaceholder:  "Hãy cho tôi biết tuổi, số người trong hộ và thu nhập của bạn…",
  chatPlaceholder:     "Đặt câu hỏi về MassHealth…",
  send:                "Gửi",
  outOfTopicLabel:     "Câu hỏi ngoài phạm vi sẽ nhận:",
  fallbackReply:
    "Tôi không thể hoàn tất yêu cầu đó. Vui lòng thử lại hoặc gọi MassHealth theo số (800) 841-2900.",
  serviceUnavailable:
    "Tôi không thể kết nối tới dịch vụ AI cục bộ. Hãy xác nhận Ollama đang chạy.",
}

// ── Assembled catalog ─────────────────────────────────────────────────────────

/**
 * Full copy catalog for every supported language.
 * Spread order: English baseline first, locale overrides second.
 * Adding a language = add a const above + add an entry here.
 */
const CHAT_WIDGET_CATALOG: Record<SupportedLanguage, ChatWidgetCopy> = {
  en:      { ...EN_CHAT_WIDGET },
  "zh-CN": { ...EN_CHAT_WIDGET, ...ZH_CN_CHAT_WIDGET },
  ht:      { ...EN_CHAT_WIDGET, ...HT_CHAT_WIDGET },
  "pt-BR": { ...EN_CHAT_WIDGET, ...PT_BR_CHAT_WIDGET },
  es:      { ...EN_CHAT_WIDGET, ...ES_CHAT_WIDGET },
  vi:      { ...EN_CHAT_WIDGET, ...VI_CHAT_WIDGET },
}

// ── Public accessor ───────────────────────────────────────────────────────────

/**
 * Returns the full copy object for the requested language.
 * Falls back to English for any unrecognised locale.
 *
 * @example
 *   const copy = getChatWidgetCopy(selectedLanguage)
 *   <h2>{copy.title}</h2>
 */
export function getChatWidgetCopy(language: SupportedLanguage): ChatWidgetCopy {
  return CHAT_WIDGET_CATALOG[language] ?? CHAT_WIDGET_CATALOG.en
}

/** Exported for exhaustive unit tests only. */
export const CHAT_WIDGET_ALL_KEYS = Object.keys(EN_CHAT_WIDGET) as ChatWidgetCopyKey[]
