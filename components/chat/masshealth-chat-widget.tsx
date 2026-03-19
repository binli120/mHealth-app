/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"
import { ExternalLink, ListChecks, Loader2, MessageCircle, SendHorizontal, ShieldCheck, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { useAutoScroll } from "@/hooks/use-auto-scroll"
import {
  getBenefitAdvisorGreeting,
  getMassHealthCommonQuestions,
  getMassHealthGreeting,
  getMassHealthOutOfScopeResponse,
} from "@/lib/masshealth/chat-knowledge"
import type {
  WidgetView,
  ChatApiResponse,
  WidgetMessage,
  WidgetSystemMessageKey,
} from "./types"

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

interface ChatWidgetCopy {
  openAssistant: string
  hideAssistant: string
  dialogLabel: string
  title: string
  languagePlaceholder: string
  close: string
  advisorDescription: string
  chatDescription: string
  advisorTab: string
  faqTab: string
  chatTab: string
  reset: string
  faqHint: string
  chatAboutThis: string
  officialSource: string
  advisorDisclaimer: string
  checkingEligibility: string
  thinking: string
  advisorPlaceholder: string
  chatPlaceholder: string
  send: string
  outOfTopicLabel: string
  fallbackReply: string
  serviceUnavailable: string
}

const CHAT_WIDGET_COPY: Record<SupportedLanguage, ChatWidgetCopy> = {
  en: {
    openAssistant: "Open MassHealth assistant",
    hideAssistant: "Hide MassHealth assistant",
    dialogLabel: "MassHealth AI Assistant",
    title: "MassHealth AI Assistant",
    languagePlaceholder: "Language",
    close: "Close",
    advisorDescription: "Tell me about your situation and I'll check eligibility using official MassHealth rules.",
    chatDescription: "MassHealth-only support. Ask about eligibility, applications, renewals, and benefits.",
    advisorTab: "Benefit Advisor",
    faqTab: "Common Questions",
    chatTab: "Chat",
    reset: "Reset",
    faqHint: "Pick a common question below or switch to Chat to type your own.",
    chatAboutThis: "Chat about this",
    officialSource: "Official source",
    advisorDisclaimer: "Eligibility determined by rule engine — LLM explains, never decides.",
    checkingEligibility: "Checking eligibility…",
    thinking: "Thinking…",
    advisorPlaceholder: "Tell me your age, household size, and income…",
    chatPlaceholder: "Ask a MassHealth question…",
    send: "Send",
    outOfTopicLabel: "Out-of-topic prompts get:",
    fallbackReply: "I couldn't complete that request. Please try again, or call MassHealth at (800) 841-2900.",
    serviceUnavailable: "I couldn't reach the local AI service. Confirm Ollama is running.",
  },
  "zh-CN": {
    openAssistant: "打开 MassHealth 助手",
    hideAssistant: "隐藏 MassHealth 助手",
    dialogLabel: "MassHealth AI 助手",
    title: "MassHealth AI 助手",
    languagePlaceholder: "语言",
    close: "关闭",
    advisorDescription: "请告诉我您的情况，我会根据官方 MassHealth 规则帮您检查资格。",
    chatDescription: "仅限 MassHealth 支持。您可以询问资格、申请、续保和福利。",
    advisorTab: "福利顾问",
    faqTab: "常见问题",
    chatTab: "聊天",
    reset: "重置",
    faqHint: "请从下面选择一个常见问题，或切换到聊天自行输入。",
    chatAboutThis: "继续聊这个问题",
    officialSource: "官方来源",
    advisorDisclaimer: "资格由规则引擎判定，LLM 只负责解释，不负责决定。",
    checkingEligibility: "正在检查资格…",
    thinking: "正在思考…",
    advisorPlaceholder: "请输入您的年龄、家庭人数和收入…",
    chatPlaceholder: "请输入一个 MassHealth 问题…",
    send: "发送",
    outOfTopicLabel: "超出范围的问题将得到：",
    fallbackReply: "我无法完成该请求。请重试，或致电 MassHealth：(800) 841-2900。",
    serviceUnavailable: "我无法连接到本地 AI 服务。请确认 Ollama 正在运行。",
  },
  ht: {
    openAssistant: "Louvri asistan MassHealth la",
    hideAssistant: "Kache asistan MassHealth la",
    dialogLabel: "Asistan AI MassHealth",
    title: "Asistan AI MassHealth",
    languagePlaceholder: "Lang",
    close: "Fèmen",
    advisorDescription: "Di m sitiyasyon ou epi m ap verifye kalifikasyon ou dapre règ ofisyèl MassHealth yo.",
    chatDescription: "Sipò pou MassHealth sèlman. Poze kestyon sou kalifikasyon, aplikasyon, renouvèlman ak benefis.",
    advisorTab: "Konseye Benefis",
    faqTab: "Kestyon Komen",
    chatTab: "Chat",
    reset: "Rekòmanse",
    faqHint: "Chwazi yon kestyon komen anba a oswa chanje pou Chat pou ekri pa w.",
    chatAboutThis: "Pale sou sa",
    officialSource: "Sous ofisyèl",
    advisorDisclaimer: "Motè règ la detèmine kalifikasyon an; LLM nan sèlman esplike li.",
    checkingEligibility: "Ap verifye kalifikasyon…",
    thinking: "Ap reflechi…",
    advisorPlaceholder: "Di m laj ou, kantite moun nan kay la, ak revni ou…",
    chatPlaceholder: "Poze yon kestyon sou MassHealth…",
    send: "Voye",
    outOfTopicLabel: "Pou kestyon ki pa nan sijè a, repons lan se:",
    fallbackReply: "M pa t ka fini demann sa a. Tanpri eseye ankò, oswa rele MassHealth nan (800) 841-2900.",
    serviceUnavailable: "M pa t ka konekte ak sèvis AI lokal la. Verifye Ollama ap mache.",
  },
  "pt-BR": {
    openAssistant: "Abrir assistente do MassHealth",
    hideAssistant: "Ocultar assistente do MassHealth",
    dialogLabel: "Assistente de IA do MassHealth",
    title: "Assistente de IA do MassHealth",
    languagePlaceholder: "Idioma",
    close: "Fechar",
    advisorDescription: "Conte sua situação e eu vou verificar a elegibilidade usando as regras oficiais do MassHealth.",
    chatDescription: "Suporte apenas para MassHealth. Pergunte sobre elegibilidade, inscrição, renovação e benefícios.",
    advisorTab: "Consultor de Benefícios",
    faqTab: "Perguntas Frequentes",
    chatTab: "Chat",
    reset: "Reiniciar",
    faqHint: "Escolha uma pergunta comum abaixo ou mude para o chat para digitar a sua.",
    chatAboutThis: "Conversar sobre isso",
    officialSource: "Fonte oficial",
    advisorDisclaimer: "A elegibilidade é determinada pelo motor de regras; o LLM apenas explica.",
    checkingEligibility: "Verificando elegibilidade…",
    thinking: "Pensando…",
    advisorPlaceholder: "Informe sua idade, o tamanho da família e a renda…",
    chatPlaceholder: "Faça uma pergunta sobre o MassHealth…",
    send: "Enviar",
    outOfTopicLabel: "Perguntas fora do tema recebem:",
    fallbackReply: "Não consegui concluir essa solicitação. Tente novamente ou ligue para o MassHealth em (800) 841-2900.",
    serviceUnavailable: "Não consegui acessar o serviço local de IA. Confirme que o Ollama está em execução.",
  },
  es: {
    openAssistant: "Abrir asistente de MassHealth",
    hideAssistant: "Ocultar asistente de MassHealth",
    dialogLabel: "Asistente de IA de MassHealth",
    title: "Asistente de IA de MassHealth",
    languagePlaceholder: "Idioma",
    close: "Cerrar",
    advisorDescription: "Cuénteme su situación y revisaré su elegibilidad usando las reglas oficiales de MassHealth.",
    chatDescription: "Soporte solo para MassHealth. Pregunte sobre elegibilidad, solicitudes, renovaciones y beneficios.",
    advisorTab: "Asesor de Beneficios",
    faqTab: "Preguntas Comunes",
    chatTab: "Chat",
    reset: "Restablecer",
    faqHint: "Elija una pregunta común abajo o cambie a Chat para escribir la suya.",
    chatAboutThis: "Hablar de esto",
    officialSource: "Fuente oficial",
    advisorDisclaimer: "La elegibilidad la determina el motor de reglas; el LLM solo la explica.",
    checkingEligibility: "Revisando elegibilidad…",
    thinking: "Pensando…",
    advisorPlaceholder: "Dígame su edad, el tamaño de su hogar y sus ingresos…",
    chatPlaceholder: "Haga una pregunta sobre MassHealth…",
    send: "Enviar",
    outOfTopicLabel: "Las preguntas fuera del tema reciben:",
    fallbackReply: "No pude completar esa solicitud. Inténtelo de nuevo o llame a MassHealth al (800) 841-2900.",
    serviceUnavailable: "No pude conectarme al servicio local de IA. Confirme que Ollama esté en ejecución.",
  },
  vi: {
    openAssistant: "Mở trợ lý MassHealth",
    hideAssistant: "Ẩn trợ lý MassHealth",
    dialogLabel: "Trợ lý AI MassHealth",
    title: "Trợ lý AI MassHealth",
    languagePlaceholder: "Ngôn ngữ",
    close: "Đóng",
    advisorDescription: "Hãy cho tôi biết tình hình của bạn và tôi sẽ kiểm tra điều kiện theo các quy định chính thức của MassHealth.",
    chatDescription: "Chỉ hỗ trợ về MassHealth. Hãy hỏi về điều kiện, nộp đơn, gia hạn và quyền lợi.",
    advisorTab: "Tư Vấn Phúc Lợi",
    faqTab: "Câu Hỏi Thường Gặp",
    chatTab: "Chat",
    reset: "Đặt lại",
    faqHint: "Chọn một câu hỏi phổ biến bên dưới hoặc chuyển sang Chat để tự nhập câu hỏi.",
    chatAboutThis: "Trao đổi về mục này",
    officialSource: "Nguồn chính thức",
    advisorDisclaimer: "Điều kiện do bộ quy tắc xác định; LLM chỉ giải thích, không quyết định.",
    checkingEligibility: "Đang kiểm tra điều kiện…",
    thinking: "Đang suy nghĩ…",
    advisorPlaceholder: "Hãy cho tôi biết tuổi, số người trong hộ và thu nhập của bạn…",
    chatPlaceholder: "Đặt câu hỏi về MassHealth…",
    send: "Gửi",
    outOfTopicLabel: "Câu hỏi ngoài phạm vi sẽ nhận:",
    fallbackReply: "Tôi không thể hoàn tất yêu cầu đó. Vui lòng thử lại hoặc gọi MassHealth theo số (800) 841-2900.",
    serviceUnavailable: "Tôi không thể kết nối tới dịch vụ AI cục bộ. Hãy xác nhận Ollama đang chạy.",
  },
}

function createAssistantMessage(
  content: string,
  systemKey?: WidgetSystemMessageKey,
  eligibilityResults?: ChatApiResponse["eligibilityResults"],
): WidgetMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    content,
    eligibilityResults,
    systemKey,
  }
}

function resolveSystemMessageContent(
  systemKey: WidgetSystemMessageKey,
  options: {
    greeting: string
    advisorGreeting: string
    outOfScopeReply: string
    copy: ChatWidgetCopy
  },
) {
  switch (systemKey) {
    case "chatGreeting":
      return options.greeting
    case "advisorGreeting":
      return options.advisorGreeting
    case "outOfScope":
      return options.outOfScopeReply
    case "requestFailed":
      return options.copy.fallbackReply
    case "serviceUnavailable":
      return options.copy.serviceUnavailable
    default:
      return null
  }
}

function relocalizeMessages(
  previous: WidgetMessage[],
  options: {
    greeting: string
    advisorGreeting: string
    outOfScopeReply: string
    copy: ChatWidgetCopy
  },
) {
  let changed = false

  const next = previous.map((message) => {
    if (!message.systemKey) return message

    const content = resolveSystemMessageContent(message.systemKey, options)
    if (!content || content === message.content) return message

    changed = true
    return { ...message, content }
  })

  return changed ? next : previous
}

function EligibilityResultsBadges({
  results,
}: {
  results: ChatApiResponse["eligibilityResults"]
}) {
  const programs = results?.programs
  if (!programs || programs.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {programs.map((p) => (
        <Badge
          key={p.program}
          variant={p.eligible ? "default" : "secondary"}
          className="text-xs"
        >
          {p.eligible ? "✓" : "✗"} {p.program}
        </Badge>
      ))}
    </div>
  )
}

function MessageBubble({ message }: { message: WidgetMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        ].join(" ")}
      >
        {message.content}
        {!isUser && message.eligibilityResults && (
          <EligibilityResultsBadges results={message.eligibilityResults} />
        )}
      </div>
    </div>
  )
}

export function MassHealthChatWidget() {
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<WidgetView>("advisor")
  const copy = useMemo(() => CHAT_WIDGET_COPY[selectedLanguage], [selectedLanguage])
  const faqs = useMemo(() => getMassHealthCommonQuestions(selectedLanguage), [selectedLanguage])
  const greeting = useMemo(() => getMassHealthGreeting(selectedLanguage), [selectedLanguage])
  const advisorGreeting = useMemo(() => getBenefitAdvisorGreeting(selectedLanguage), [selectedLanguage])
  const outOfScopeReply = useMemo(
    () => getMassHealthOutOfScopeResponse(selectedLanguage),
    [selectedLanguage],
  )

  // Regular chat messages
  const [messages, setMessages] = useState<WidgetMessage[]>([
    createAssistantMessage(greeting, "chatGreeting"),
  ])
  // Benefit advisor messages (separate history)
  const [advisorMessages, setAdvisorMessages] = useState<WidgetMessage[]>([
    createAssistantMessage(advisorGreeting, "advisorGreeting"),
  ])

  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const bottomAnchorRef = useAutoScroll([messages, advisorMessages, isLoading, open, view])

  useEffect(() => {
    const options = { greeting, advisorGreeting, outOfScopeReply, copy }
    setMessages((previous) => relocalizeMessages(previous, options))
    setAdvisorMessages((previous) => relocalizeMessages(previous, options))
  }, [advisorGreeting, copy, greeting, outOfScopeReply])

  const handleLanguageChange = (value: string) => {
    if (isSupportedLanguage(value)) dispatch(setLanguage(value))
  }

  const isAdvisorView = view === "advisor"

  const sendMessage = async (input: string) => {
    const message = input.trim()
    if (!message || isLoading) return

    if (!isAdvisorView) setView("chat")
    setDraft("")
    setIsLoading(true)

    const currentMessages = isAdvisorView ? advisorMessages : messages
    const setCurrentMessages = isAdvisorView ? setAdvisorMessages : setMessages

    const nextMessages: WidgetMessage[] = [
      ...currentMessages,
      { id: createMessageId(), role: "user", content: message },
    ]
    setCurrentMessages(nextMessages)

    try {
      const response = await authenticatedFetch("/api/chat/masshealth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-12).map(({ role, content }) => ({ role, content })),
          language: selectedLanguage,
          ...(isAdvisorView ? { mode: "benefit_advisor" } : {}),
        }),
      })

      const data = (await response.json()) as ChatApiResponse
      const reply = data.reply?.trim() || (data.outOfScope ? outOfScopeReply : copy.fallbackReply)
      const systemKey: WidgetSystemMessageKey | undefined = data.reply?.trim()
        ? undefined
        : data.outOfScope
          ? "outOfScope"
          : "requestFailed"

      setCurrentMessages((previous) => [
        ...previous,
        createAssistantMessage(reply, systemKey, data.eligibilityResults),
      ])
    } catch (error) {
      console.error("MassHealth chat request failed", error)
      const setMsg = isAdvisorView ? setAdvisorMessages : setMessages
      setMsg((previous) => [
        ...previous,
        createAssistantMessage(copy.serviceUnavailable, "serviceUnavailable"),
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendMessage(draft)
  }

  const handleFaqAsk = async (question: string) => {
    await sendMessage(question)
  }

  const handleResetChat = () => {
    setMessages([createAssistantMessage(greeting, "chatGreeting")])
    setAdvisorMessages([createAssistantMessage(advisorGreeting, "advisorGreeting")])
    setDraft("")
    setView("advisor")
  }

  const activeMessages = isAdvisorView ? advisorMessages : messages
  const chatPlaceholder = isAdvisorView ? copy.advisorPlaceholder : copy.chatPlaceholder

  return (
    <>
      <Button
        size="icon-lg"
        className="fixed right-5 bottom-5 z-50 h-14 w-14 rounded-full shadow-xl"
        aria-label={open ? copy.hideAssistant : copy.openAssistant}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {open ? (
        <section
          role="dialog"
          aria-label={copy.dialogLabel}
          className="fixed right-5 bottom-24 z-40 flex h-[min(80vh,760px)] w-[min(92vw,440px)] flex-col overflow-hidden rounded-lg border bg-background shadow-2xl"
        >
          {/* Header */}
          <header className="border-b px-5 py-4 text-left">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{copy.title}</h2>
              <div className="flex items-center gap-2">
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="h-8 w-[150px]">
                    <SelectValue placeholder={copy.languagePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={copy.close}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              {isAdvisorView
                ? copy.advisorDescription
                : copy.chatDescription}
            </p>
          </header>

          {/* Tab bar */}
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={view === "advisor" ? "default" : "outline"}
                onClick={() => setView("advisor")}
              >
                <ShieldCheck className="h-4 w-4" />
                {copy.advisorTab}
              </Button>
              <Button
                size="sm"
                variant={view === "faq" ? "default" : "outline"}
                onClick={() => setView("faq")}
              >
                <ListChecks className="h-4 w-4" />
                {copy.faqTab}
              </Button>
              <Button
                size="icon-sm"
                variant={view === "chat" ? "default" : "outline"}
                aria-label={copy.chatTab}
                onClick={() => setView("chat")}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleResetChat} className="ml-auto">
                {copy.reset}
              </Button>
            </div>
          </div>

          {/* FAQ view */}
          {view === "faq" ? (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                <div className="rounded-xl border bg-secondary/40 p-4">
                  <p className="text-sm text-secondary-foreground">{greeting}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copy.faqHint}
                  </p>
                </div>
                {faqs.map((faq) => (
                  <article key={faq.id} className="space-y-3 rounded-xl border p-4">
                    <h3 className="text-sm font-semibold text-foreground">{faq.question}</h3>
                    <p className="text-sm text-muted-foreground">{faq.quickAnswer}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => { void handleFaqAsk(faq.question) }}
                        disabled={isLoading}
                      >
                        {copy.chatAboutThis}
                      </Button>
                      {faq.links.slice(0, 1).map((link) => (
                        <Button key={link.url} asChild size="sm" variant="outline">
                          <a href={link.url} target="_blank" rel="noreferrer">
                            {copy.officialSource}
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </ScrollArea>

          ) : (
            /* Chat / Advisor shared chat UI */
            <div className="flex min-h-0 flex-1 flex-col">
              {isAdvisorView && (
                <div className="bg-muted/40 border-b px-4 py-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mr-1 inline h-3 w-3" />
                  {copy.advisorDisclaimer}
                </div>
              )}

              <ScrollArea className="min-h-0 flex-1 px-4">
                <div className="space-y-3 py-4">
                  {activeMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isLoading ? (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm text-secondary-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isAdvisorView ? copy.checkingEligibility : copy.thinking}
                      </div>
                    </div>
                  ) : null}
                  <div ref={bottomAnchorRef} />
                </div>
              </ScrollArea>

              <form onSubmit={handleSubmit} className="border-t p-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={chatPlaceholder}
                    disabled={isLoading}
                  />
                  <Button type="submit" disabled={isLoading || !draft.trim()}>
                    <SendHorizontal className="h-4 w-4" />
                    {copy.send}
                  </Button>
                </div>
                {!isAdvisorView && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copy.outOfTopicLabel} &ldquo;{outOfScopeReply}&rdquo;
                  </p>
                )}
              </form>
            </div>
          )}
        </section>
      ) : null}
    </>
  )
}
