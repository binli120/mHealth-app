/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  type IntakeChatCopy,
  IntakeChatPanel,
} from "@/components/application/aca3/intake-chat-panel"
import {
  type IntakeMessage,
  splitTrailingQuestion,
} from "@/components/application/aca3/intake-chat-message-bubble"

// (no constants needed directly in this file after extraction)
import { useRouter } from "next/navigation"
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { setApplicationWizardState, DEFAULT_APPLICATION_ID } from "@/lib/redux/features/application-slice"
import type { UserProfile } from "@/lib/user-profile/types"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { createUuid } from "@/lib/utils/random-id"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { countHouseholdRelationshipMentions } from "@/lib/masshealth/household-relationships"
import { type WidgetSpec, } from "@/components/application/aca3/intake-question-widget"
import { splitWizardState } from "@/lib/phi-token/token"
import { PhiSaveExitDialog } from "@/components/application/phi-save-exit-dialog"
import {
  buildQuestions,
  buildContextValuesForQuestion,
  computeAnsweredQuestionIds,
  createInitialIntakeData,
  deriveSkippedFromLastAnswered,
  findNextPendingQuestion,
  getAddressSiblingFieldIds,
  getWizardStepForIntakeProgress,
  isFilledValue,
  isRequiredInCurrentContext,
  readValue,
  shouldSkipQuestionInChat,
  validateParsedFieldValue,
  writeFieldById,
  writeValue,
} from "@/components/application/aca3/intake-chat-question-builder"
import type { IntakeQuestion } from "@/components/application/aca3/intake-chat-types"
import type {
  AddressValidationResponse,
  FieldValue,
  FormRecord,
  PersonState,
  SchemaField,
  WizardData,
  WizardState,
} from "@/components/application/aca3/types"
import {
  clampPersonCount,
  createDraftWizardState,
  ensurePersonCount,
  getFormCacheKey,
} from "./wizard-reducer"
import {
  applyInitialMemoExtraction,
  applyProfileToWizardData,
  buildAcknowledgementPrefix,
  buildProfileFilledLabels,
  formatDisplayValue,
  formatQuestionPrompt,
  isDeclineAnswer,
  normalizeFlexibleDateInput,
  parseAnswerValue,
  resolveSpeechLanguage,
  restoreWizardDataFromRaw,
  toSpeakableQuestionText,
} from "./intake-chat-answer-parser"

interface ChatApiResponse {
  ok: boolean
  outOfScope?: boolean
  reply?: string
}

interface IntakeChatProps {
  applicationId?: string
  actingForPatientId?: string
  onSwitchToWizard: () => void
  onSaveAndExit?: () => void
}

const SPOKEN_LANGUAGE_TO_CODE: Record<string, SupportedLanguage> = {
  chinese: "zh-CN",
  mandarin: "zh-CN",
  cantonese: "zh-CN",
  "simplified chinese": "zh-CN",
  "traditional chinese": "zh-CN",
  spanish: "es",
  español: "es",
  portuguese: "pt-BR",
  "haitian creole": "ht",
  haitian: "ht",
  creole: "ht",
  vietnamese: "vi",
}

const UI_COPY: Record<SupportedLanguage, IntakeChatCopy> = {
  en: {
    title: "Application Intake Chat",
    subtitle: "Chat will ask the same schema-backed questions as the wizard flow.",
    openingMemoPrompt: "Could you tell me about yourself and your household in a few sentences?",
    switchToWizard: "Switch to Form Wizard",
    placeholder: "Type your answer...",
    saving: "Saving...",
    send: "Send",
    resetChat: "Reset chat",
    autoPlay: "Auto-play question",
    complete: "All intake questions are complete. Next, verify your identity and submit your application.",
    savedPrefix: "Thanks",
  },
  es: {
    title: "Chat de Solicitud",
    subtitle: "El chat hace las mismas preguntas del esquema que el asistente por pasos.",
    openingMemoPrompt: "¿Puede contarme sobre usted y su hogar en unas frases?",
    switchToWizard: "Cambiar a Formulario",
    placeholder: "Escriba su respuesta...",
    saving: "Guardando...",
    send: "Enviar",
    resetChat: "Reiniciar chat",
    autoPlay: "Reproducir pregunta automáticamente",
    complete: "Todas las preguntas de admisión están completas. Ahora verifique su identidad y envíe su solicitud.",
    savedPrefix: "Gracias",
  },
  "pt-BR": {
    title: "Chat de Inscrição",
    subtitle: "O chat faz as mesmas perguntas baseadas no esquema do formulário.",
    openingMemoPrompt: "Você pode me contar sobre você e sua família em algumas frases?",
    switchToWizard: "Mudar para Formulário",
    placeholder: "Digite sua resposta...",
    saving: "Salvando...",
    send: "Enviar",
    resetChat: "Reiniciar chat",
    autoPlay: "Reproduzir pergunta automaticamente",
    complete: "Todas as perguntas foram concluídas. Agora verifique sua identidade e envie sua solicitação.",
    savedPrefix: "Obrigado",
  },
  "zh-CN": {
    title: "申请聊天",
    subtitle: "聊天会按与表单向导相同的字段提问。",
    openingMemoPrompt: "请先用几句话介绍您自己和您的家庭情况，可以吗？",
    switchToWizard: "切换到表单向导",
    placeholder: "请输入您的回答...",
    saving: "正在保存...",
    send: "发送",
    resetChat: "重置聊天",
    autoPlay: "自动朗读问题",
    complete: "所有采集问题已完成。接下来请验证身份并提交申请。",
    savedPrefix: "谢谢",
  },
  ht: {
    title: "Chat Aplikasyon",
    subtitle: "Chat la ap poze menm kestyon ki nan form wizard la.",
    openingMemoPrompt: "Èske ou ka rakonte m sou ou menm ak moun lakay ou an kèk fraz?",
    switchToWizard: "Chanje pou Form Wizard",
    placeholder: "Ekri repons ou...",
    saving: "Ap sove...",
    send: "Voye",
    resetChat: "Rekòmanse chat",
    autoPlay: "Li kestyon an otomatikman",
    complete: "Tout kestyon yo fini. Kounye a verifye idantite ou epi soumèt aplikasyon an.",
    savedPrefix: "Mèsi",
  },
  vi: {
    title: "Chat Đơn Đăng Ký",
    subtitle: "Chat sẽ hỏi cùng bộ câu hỏi theo schema như form-wizard.",
    openingMemoPrompt: "Bạn có thể giới thiệu về bản thân và hộ gia đình của bạn trong vài câu không?",
    switchToWizard: "Chuyển sang Form Wizard",
    placeholder: "Nhập câu trả lời của bạn...",
    saving: "Đang lưu...",
    send: "Gửi",
    resetChat: "Đặt lại chat",
    autoPlay: "Tự phát câu hỏi",
    complete: "Đã hoàn thành các câu hỏi thu thập. Tiếp theo, hãy xác minh danh tính và nộp đơn.",
    savedPrefix: "Cảm ơn",
  },
}

function createMessageId() {
  return createUuid()
}

// isFilledValue, isRequiredInCurrentContext, validateParsedFieldValue
// are imported from ./intake-chat-question-builder above.

interface AddressAutofillResult {
  data: WizardData
  filledFieldIds: string[]
  validationError: string | null
  validationNote: string | null
}

async function applyAddressAutofillFromAnswer(
  data: WizardData,
  question: IntakeQuestion,
  answer: string,
): Promise<AddressAutofillResult> {
  if (question.field.type !== "text" || !question.field.id.toLowerCase().endsWith("_street")) {
    return {
      data,
      filledFieldIds: [],
      validationError: null,
      validationNote: null,
    }
  }

  const parsed = parsePastedUsAddress(answer)
  if (!parsed) {
    return {
      data,
      filledFieldIds: [],
      validationError: null,
      validationNote: null,
    }
  }

  const siblingIds = getAddressSiblingFieldIds(question.field.id)
  if (!siblingIds) {
    return {
      data,
      filledFieldIds: [],
      validationError: null,
      validationNote: null,
    }
  }

  let nextData = data
  nextData = writeFieldById(nextData, question, siblingIds.streetId, parsed.streetAddress)
  nextData = writeFieldById(nextData, question, siblingIds.cityId, parsed.city)
  nextData = writeFieldById(nextData, question, siblingIds.stateId, parsed.state)
  nextData = writeFieldById(nextData, question, siblingIds.zipId, parsed.zipCode)

  try {
    const response = await authenticatedFetch("/api/address/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        streetAddress: parsed.streetAddress,
        city: parsed.city,
        state: parsed.state,
        zipCode: parsed.zipCode,
      }),
    })

    const result = (await response.json()) as AddressValidationResponse
    if (!response.ok || !result.ok) {
      return {
        data: nextData,
        filledFieldIds: [],
        validationError: "I couldn't validate that address right now. Please try the address again.",
        validationNote: null,
      }
    }

    if (!result.valid && !result.suggestion) {
      return {
        data: nextData,
        filledFieldIds: [],
        validationError: result.message || "I could not validate that address. Please re-enter it.",
        validationNote: null,
      }
    }

    if (result.suggestion) {
      const suggestion = result.suggestion
      nextData = writeFieldById(nextData, question, siblingIds.streetId, suggestion.streetAddress.trim())
      nextData = writeFieldById(nextData, question, siblingIds.cityId, suggestion.city.trim())
      nextData = writeFieldById(nextData, question, siblingIds.stateId, suggestion.state.trim().toUpperCase())
      nextData = writeFieldById(
        nextData,
        question,
        siblingIds.zipId,
        suggestion.zipCode.replace(/\D/g, "").slice(0, 5),
      )

      if (siblingIds.countyId && suggestion.county.trim()) {
        nextData = writeFieldById(nextData, question, siblingIds.countyId, suggestion.county.trim())
      }
    }

    return {
      data: nextData,
      filledFieldIds: [siblingIds.streetId, siblingIds.cityId, siblingIds.stateId, siblingIds.zipId],
      validationError: null,
      validationNote: result.message || null,
    }
  } catch {
    return {
      data: nextData,
      filledFieldIds: [],
      validationError: "I couldn't validate that address right now. Please try again.",
      validationNote: null,
    }
  }
}

export { createInitialIntakeData } from "./intake-chat-question-builder"
export { parseAnswerValue as parseIntakeAnswerValue } from "./intake-chat-answer-parser"
export { buildQuestions as buildIntakeQuestions } from "./intake-chat-question-builder"
export { computeAnsweredQuestionIds as computeAnsweredIntakeQuestionIds } from "./intake-chat-question-builder"
export { findNextPendingQuestion as findNextPendingIntakeQuestion } from "./intake-chat-question-builder"
export { getWizardStepForIntakeProgress } from "./intake-chat-question-builder"
export { writeValue as writeIntakeQuestionValue } from "./intake-chat-question-builder"

export function IntakeChat({ applicationId, actingForPatientId, onSwitchToWizard, onSaveAndExit }: IntakeChatProps) {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const activeApplicationId = useAppSelector((state) => state.application.activeApplicationId)
  const resolvedApplicationId = applicationId ?? activeApplicationId ?? DEFAULT_APPLICATION_ID
  const selectedApplicationType = useAppSelector((state) => {
    if (!resolvedApplicationId) {
      return ""
    }

    return state.application.applicationsById[resolvedApplicationId]?.newApplicationForm.applicationType ?? ""
  })

  const savedAca3Wizard = useAppSelector((state) => {
    if (!resolvedApplicationId) return null
    return state.application.applicationsById[resolvedApplicationId]?.aca3Wizard ?? null
  })

  const userProfile = useAppSelector((state) => state.userProfile?.profile ?? null)

  const copy = UI_COPY[selectedLanguage]

  const handleLanguageChange = (value: string) => {
    if (isSupportedLanguage(value)) {
      dispatch(setLanguage(value))
    }
  }

  const [wizardData, setWizardData] = useState<WizardData>(() => createInitialIntakeData())
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(() => new Set())
  const [skippedQuestionIds, setSkippedQuestionIds] = useState<Set<string>>(() => new Set())
  const [intakeStarted, setIntakeStarted] = useState(false)
  const [hydrationPending, setHydrationPending] = useState(true)
  // "pending"  — waiting for user's yes/no on profile pre-fill
  // "accepted" — profile applied; normal intake continues
  // "declined" — user declined or no profile; normal intake flow
  const [profilePrefillMode, setProfilePrefillMode] = useState<"pending" | "accepted" | "declined">("declined")
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<IntakeMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [saveExitDialogOpen, setSaveExitDialogOpen] = useState(false)
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null)
  const translationCacheRef = useRef<Map<string, string>>(new Map())
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const draftSaveBackoffUntilRef = useRef(0)
  const hydratedRef = useRef(false)

  const applyRestoredWizardState = useCallback((raw: unknown) => {
    const restored = restoreWizardDataFromRaw(raw)
    if (!restored) return false
    const restoredQuestions = buildQuestions(restored)
    const restoredAnswered = computeAnsweredQuestionIds(restoredQuestions, restored)
    if (restoredAnswered.size === 0) return false

    // Restore explicitly persisted skipped IDs (new sessions).
    const rawObj = raw as Record<string, unknown>
    const persistedSkipped = new Set<string>()
    if (Array.isArray(rawObj.chatSkippedIds)) {
      for (const id of rawObj.chatSkippedIds) {
        if (typeof id === "string") persistedSkipped.add(id)
      }
    }

    // Derive skipped IDs from the last-answered checkpoint (covers legacy sessions
    // saved before chatSkippedIds was persisted, and acts as a safety net for new ones).
    const restoredSkipped = deriveSkippedFromLastAnswered(
      restoredQuestions, restoredAnswered, restored, persistedSkipped,
    )

    setWizardData(restored)
    setAnsweredQuestionIds(restoredAnswered)
    setSkippedQuestionIds(restoredSkipped)
    setIntakeStarted(true)
    const nextQ = findNextPendingQuestion(restoredQuestions, restoredAnswered, restored, restoredSkipped)
    setCurrentQuestionId(nextQ?.id ?? null)
    return true
  }, [])

  // Intercept browser back button once the chat has started so users don't
  // accidentally leave without saving.
  useEffect(() => {
    if (!intakeStarted) return
    window.history.pushState(null, "", window.location.href)
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href)
      setSaveExitDialogOpen(true)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [intakeStarted])

  // Restore previous session data from Redux cache or server draft on mount.
  useEffect(() => {
    if (hydratedRef.current) {
      setHydrationPending(false)
      return
    }

    // Try Redux cache first (fast, synchronous).
    if (savedAca3Wizard && applyRestoredWizardState(savedAca3Wizard)) {
      hydratedRef.current = true
      setHydrationPending(false)
      return
    }

    // Fall back to server draft.
    if (resolvedApplicationId === DEFAULT_APPLICATION_ID) {
      setHydrationPending(false)
      return
    }
    let cancelled = false
    const loadFromServer = async () => {
      try {
        const headers = actingForPatientId
          ? { "X-Acting-For-Patient": actingForPatientId }
          : undefined
        const response = await authenticatedFetch(
          `/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`,
          { method: "GET", cache: "no-store", ...(headers ? { headers } : {}) },
        )
        if (!response.ok || cancelled) {
          if (!cancelled) setHydrationPending(false)
          return
        }
        const payload = (await response.json()) as { draftState?: unknown }
        if (!cancelled) {
          if (applyRestoredWizardState(payload.draftState)) {
            hydratedRef.current = true
          }
          setHydrationPending(false)
        }
      } catch {
        // Draft load is best-effort; fresh session is fine.
        if (!cancelled) setHydrationPending(false)
      }
    }
    void loadFromServer()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actingForPatientId, resolvedApplicationId, applyRestoredWizardState])

  useEffect(() => {
    if (hydrationPending || !savedAca3Wizard) {
      return
    }

    applyRestoredWizardState(savedAca3Wizard)
  }, [applyRestoredWizardState, hydrationPending, savedAca3Wizard])

  const applicationTypeLabel = useMemo(() => {
    return (
      MASSHEALTH_APPLICATION_TYPES.find((option) => option.id === selectedApplicationType)?.shortLabel ??
      ""
    )
  }, [selectedApplicationType])

  const questions = useMemo(() => buildQuestions(wizardData), [wizardData])

  const collectedSections = useMemo(() => {
    const sectionMap = new Map<string, { title: string; items: { label: string; value: string; questionId: string }[] }>()
    // Track label+value pairs already shown to prevent cross-section duplicates.
    const globalDedupeSet = new Set<string>()

    for (const question of questions) {
      if (!answeredQuestionIds.has(question.id)) continue
      const value = readValue(wizardData, question)
      const displayValue = formatDisplayValue(value)
      if (!displayValue) continue

      const dedupeKey = `${question.field.label.trim().toLowerCase()}::${displayValue}`
      if (globalDedupeSet.has(dedupeKey)) continue
      globalDedupeSet.add(dedupeKey)

      const sectionKey =
        question.scope === "person" ? `person:${question.personIndex ?? 0}` : question.scope

      let section = sectionMap.get(sectionKey)
      if (!section) {
        let title: string
        if (question.scope === "person") {
          title = `Person ${(question.personIndex ?? 0) + 1}`
        } else if (question.scope === "contact") {
          title = "Personal Info"
        } else if (question.scope === "preApp") {
          title = "Pre-Application"
        } else if (question.scope === "assister") {
          title = "Assister Info"
        } else {
          title = question.scope
        }
        section = { title, items: [] }
        sectionMap.set(sectionKey, section)
      }

      section.items.push({ label: question.field.label, value: displayValue, questionId: question.id })
    }

    return Array.from(sectionMap.values()).filter((s) => s.items.length > 0)
  }, [questions, answeredQuestionIds, wizardData])

  const currentQuestion = useMemo(() => {
    if (!currentQuestionId) {
      return null
    }

    return questions.find((question) => question.id === currentQuestionId) ?? null
  }, [currentQuestionId, questions])

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return
      }

      const utterance = new SpeechSynthesisUtterance(toSpeakableQuestionText(text))
      const targetLang = resolveSpeechLanguage(selectedLanguage)
      utterance.lang = targetLang

      const voices = window.speechSynthesis.getVoices()
      const matchedVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(targetLang.toLowerCase()))
      if (matchedVoice) {
        utterance.voice = matchedVoice
      }

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    [selectedLanguage],
  )

  const localizeQuestion = useCallback(
    async (text: string): Promise<string> => {
      if (selectedLanguage === "en") {
        return text
      }

      const cacheKey = `${selectedLanguage}:${text}`
      const cached = translationCacheRef.current.get(cacheKey)
      if (cached) {
        return cached
      }

      const languageLabel = SUPPORTED_LANGUAGES.find((language) => language.code === selectedLanguage)?.label ?? selectedLanguage

      try {
        const response = await authenticatedFetch("/api/chat/masshealth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "application_intake",
            messages: [
              {
                role: "user",
                content: `Translate exactly this intake question to ${languageLabel}. Return translation only. Keep option values unchanged: ${text}`,
              },
            ],
            language: selectedLanguage,
          }),
        })

        const payload = (await response.json()) as ChatApiResponse
        const translated = payload.reply?.trim()

        if (translated) {
          translationCacheRef.current.set(cacheKey, translated)
          return translated
        }
      } catch {
        // Fallback to source text if translation fails.
      }

      return text
    },
    [selectedLanguage],
  )

  const persistWizardData = useCallback(
    async (
      data: WizardData,
      opts?: { skippedIds?: Set<string>; answeredCount?: number; totalCount?: number; targetStep?: number },
    ) => {
      if (Date.now() < draftSaveBackoffUntilRef.current) {
        return
      }

      // Don't save at all if no questions have been answered yet. An
      // answeredCount of 0 means the chat just initialised / resumed and
      // hasn't collected real data — saving would stomp any existing
      // wizard draft_step with step 1.
      if ((opts?.answeredCount ?? 0) === 0) {
        return
      }

      // Keep the form wizard on the step that owns the next unanswered chat question.
      // This prevents percentage-based progress from jumping to Tax while chat is
      // still collecting Primary Applicant fields.
      const progressQuestions = buildQuestions(data)
      const progressAnswered = computeAnsweredQuestionIds(progressQuestions, data)
      const progressSkipped = opts?.skippedIds ?? new Set<string>()
      const chatStep =
        opts?.targetStep ??
        getWizardStepForIntakeProgress(progressQuestions, progressAnswered, data, progressSkipped)

      const wizardState = {
        ...createDraftWizardState(data, chatStep),
        chatSkippedIds: opts?.skippedIds ? [...opts.skippedIds] : [],
      }

      try {
        window.localStorage.setItem(
          getFormCacheKey(resolvedApplicationId),
          JSON.stringify(wizardState),
        )
      } catch {
        // Redux remains the source of truth if browser storage is unavailable.
      }

      dispatch(
        setApplicationWizardState({
          applicationId: resolvedApplicationId,
          wizardState: wizardState as unknown as Record<string, unknown>,
        }),
      )

      if (resolvedApplicationId === DEFAULT_APPLICATION_ID) {
        return
      }

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        }
        if (actingForPatientId) {
          headers["X-Acting-For-Patient"] = actingForPatientId
        }

        const { safeState } = splitWizardState(wizardState as Record<string, unknown>)
        const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            applicationType: selectedApplicationType || undefined,
            wizardState: safeState,
          }),
        })

        if (!response.ok && (response.status >= 500 || response.status === 429)) {
          draftSaveBackoffUntilRef.current = Date.now() + 15_000
          return
        }

        if (response.ok) {
          draftSaveBackoffUntilRef.current = 0
        }
      } catch {
        draftSaveBackoffUntilRef.current = Date.now() + 15_000
        // Non-blocking: local redux state remains up to date.
      }
    },
    [actingForPatientId, dispatch, resolvedApplicationId, selectedApplicationType],
  )

  const completeIntakeAndOpenVerification = useCallback(
    async (
      data: WizardData,
      refreshedQuestions: IntakeQuestion[],
      refreshedAnswered: Set<string>,
      skippedIds: Set<string>,
      message: string,
    ) => {
      setCurrentQuestionId(null)
      await persistWizardData(data, {
        skippedIds,
        answeredCount: refreshedAnswered.size,
        totalCount: refreshedQuestions.length,
        targetStep: 9,
      })
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content: message,
        },
      ])
      onSwitchToWizard()
    },
    [onSwitchToWizard, persistWizardData],
  )

  const appendAssistantQuestion = useCallback(
    async (prefix: string, question: IntakeQuestion | null) => {
      if (!question) {
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: prefix,
          },
        ])
        return
      }

      const baseQuestion = formatQuestionPrompt(question)
      const localizedQuestion = await localizeQuestion(baseQuestion)
      const content = prefix ? `${prefix} ${localizedQuestion}` : localizedQuestion

      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content,
        },
      ])
      setCurrentQuestionId(question.id)
    },
    [localizeQuestion],
  )

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    const initialize = async () => {
      // Wait until the hydration attempt (Redux cache or server fetch) has resolved.
      if (hydrationPending) return
      if (messages.length > 0) return

      // If we restored a previous session, jump straight to the next pending question.
      if (hydratedRef.current) {
        const restoredQuestions = buildQuestions(wizardData)
        const nextQ = findNextPendingQuestion(restoredQuestions, answeredQuestionIds, wizardData, skippedQuestionIds)
        await appendAssistantQuestion(`${copy.savedPrefix}, let's continue where we left off.`, nextQ)
        return
      }

      const intro = applicationTypeLabel
        ? `${copy.savedPrefix} ${applicationTypeLabel} selected. ${copy.subtitle}`
        : copy.subtitle

      // If a profile exists with contact data, offer to pre-fill instead of the opening memo.
      if (userProfile?.firstName) {
        const profileLabels = buildProfileFilledLabels(userProfile)
        const fieldList = profileLabels.join(", ")
        setProfilePrefillMode("pending")
        setMessages([
          {
            id: createMessageId(),
            role: "assistant",
            content: intro,
          },
          {
            id: createMessageId(),
            role: "assistant",
            content: `Hi ${userProfile.firstName}! I can see your ${fieldList} are already saved in your profile. Would you like me to pre-fill those fields so you can skip straight to what's missing? Type **Yes** to use your saved info, or **No** to answer the questions yourself.`,
          },
        ])
        return
      }

      setMessages([
        {
          id: createMessageId(),
          role: "assistant",
          content: intro,
        },
        {
          id: createMessageId(),
          role: "assistant",
          content: copy.openingMemoPrompt,
        },
      ])
    }

    void initialize()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationPending, applicationTypeLabel, copy.openingMemoPrompt, copy.savedPrefix, copy.subtitle, messages.length, userProfile])

  useEffect(() => {
    if (!autoSpeak) {
      return
    }

    const latest = messages[messages.length - 1]
    if (!latest || latest.role !== "assistant" || latest.id === lastSpokenMessageIdRef.current) {
      return
    }

    const { question } = splitTrailingQuestion(latest.content)
    if (!question) {
      return
    }

    lastSpokenMessageIdRef.current = latest.id
    speakText(question)
  }, [autoSpeak, messages, speakText])

  const handleAnswer = useCallback(async (answer: string) => {
    setIsLoading(true)

    try {
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "user",
          content: answer,
        },
      ])

      // ── Profile pre-fill yes/no intercept ──────────────────────────────────
      if (profilePrefillMode === "pending") {
        const normalized = answer.trim().toLowerCase()
        const isYes = /^(yes|yeah|yep|yup|sure|ok|okay|y\b)/.test(normalized)

        if (isYes && userProfile) {
          const prefilled = applyProfileToWizardData(wizardData, userProfile)
          const refreshedQs = buildQuestions(prefilled)
          const refreshedAnswered = computeAnsweredQuestionIds(refreshedQs, prefilled)
          const nextQ = findNextPendingQuestion(refreshedQs, refreshedAnswered, prefilled, skippedQuestionIds)

          setWizardData(prefilled)
          setAnsweredQuestionIds(refreshedAnswered)
          setIntakeStarted(true)
          setProfilePrefillMode("accepted")

          await persistWizardData(prefilled, {
            skippedIds: skippedQuestionIds,
            answeredCount: refreshedAnswered.size,
            totalCount: refreshedQs.length,
          })

          const appliedLabels = buildProfileFilledLabels(userProfile)
          const confirmMsg = `${copy.savedPrefix}, ${userProfile.firstName}. I've pre-filled your ${appliedLabels.join(", ")}.`

          if (!nextQ) {
            await completeIntakeAndOpenVerification(
              prefilled,
              refreshedQs,
              refreshedAnswered,
              skippedQuestionIds,
              `${confirmMsg} ${copy.complete}`,
            )
            return
          }

          await appendAssistantQuestion(confirmMsg, nextQ)
        } else {
          // Declined — show opening memo prompt and let user type their info
          setProfilePrefillMode("declined")
          setMessages((previous) => [
            ...previous,
            { id: createMessageId(), role: "assistant", content: copy.openingMemoPrompt },
          ])
        }
        return
      }

      if (!intakeStarted) {
        const extractedData = applyInitialMemoExtraction(wizardData, answer)
        const refreshedQuestions = buildQuestions(extractedData)
        const refreshedAnswered = computeAnsweredQuestionIds(refreshedQuestions, extractedData)
        const nextQuestion = findNextPendingQuestion(
          refreshedQuestions,
          refreshedAnswered,
          extractedData,
          skippedQuestionIds,
        )

        setWizardData(extractedData)
        setAnsweredQuestionIds(refreshedAnswered)
        setIntakeStarted(true)
        await persistWizardData(extractedData, {
          skippedIds: skippedQuestionIds,
          answeredCount: refreshedAnswered.size,
          totalCount: refreshedQuestions.length,
        })

        if (!nextQuestion) {
          await completeIntakeAndOpenVerification(
            extractedData,
            refreshedQuestions,
            refreshedAnswered,
            skippedQuestionIds,
            copy.complete,
          )
          return
        }

        await appendAssistantQuestion(buildAcknowledgementPrefix(copy.savedPrefix, extractedData), nextQuestion)
        return
      }

      if (!currentQuestion) {
        return
      }

      let nextData = writeValue(wizardData, currentQuestion, parseAnswerValue(currentQuestion.field, answer))
      const mergedContextValues = buildContextValuesForQuestion(nextData, currentQuestion)

      const parsedValue = readValue(nextData, currentQuestion) as FieldValue
      const validationError = validateParsedFieldValue(
        currentQuestion.field,
        parsedValue,
        mergedContextValues,
      )

      if (validationError) {
        const prompt = await localizeQuestion(formatQuestionPrompt(currentQuestion))
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: `${validationError} ${prompt}`,
          },
        ])
        return
      }

      if (currentQuestion.field.id === "p1_language_spoken") {
        const detectedLang = SPOKEN_LANGUAGE_TO_CODE[answer.trim().toLowerCase()]
        if (detectedLang) {
          dispatch(setLanguage(detectedLang))
        }
        // Mirror spoken language to written language so it isn't asked again.
        nextData = writeFieldById(nextData, currentQuestion, "p1_language_written", parsedValue)
      }

      // Sync contact name/dob into person 0 identity to avoid duplicate questions.
      if (currentQuestion.scope === "contact" && currentQuestion.field.id === "p1_name") {
        const identityQuestion: IntakeQuestion = {
          id: "person:0:identity:name",
          field: { id: "name", label: "name", type: "text" },
          scope: "person",
          sectionKey: "identity",
          personIndex: 0,
        }
        nextData = writeValue(nextData, identityQuestion, parsedValue)
      }
      if (currentQuestion.scope === "contact" && currentQuestion.field.id === "p1_dob") {
        const identityQuestion: IntakeQuestion = {
          id: "person:0:identity:dob",
          field: { id: "dob", label: "dob", type: "date" },
          scope: "person",
          sectionKey: "identity",
          personIndex: 0,
        }
        nextData = writeValue(nextData, identityQuestion, parsedValue)
      }

      const addressAutofill = await applyAddressAutofillFromAnswer(nextData, currentQuestion, answer)
      nextData = addressAutofill.data

      const validationErrorMessage = addressAutofill.validationError
      if (typeof validationErrorMessage === "string" && validationErrorMessage.length > 0) {
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: validationErrorMessage,
          },
        ])
        return
      }

      const validationNoteMessage = addressAutofill.validationNote
      if (typeof validationNoteMessage === "string" && validationNoteMessage.length > 0) {
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: validationNoteMessage,
          },
        ])
      }

      if (currentQuestion.scope === "contact" && currentQuestion.field.id === "p1_num_people") {
        const parsedCount = clampPersonCount(nextData.contact.p1_num_people)
        nextData = ensurePersonCount(nextData, parsedCount)
      }

      const refreshedQuestions = buildQuestions(nextData)
      const nextAnswered = computeAnsweredQuestionIds(refreshedQuestions, nextData)
      const nextSkipped = new Set(skippedQuestionIds)
      const isRequired = isRequiredInCurrentContext(currentQuestion.field, mergedContextValues)

      if (!isRequired && isDeclineAnswer(answer) && !isFilledValue(parsedValue)) {
        nextSkipped.add(currentQuestion.id)
      } else if (isFilledValue(parsedValue)) {
        nextSkipped.delete(currentQuestion.id)
      }

      setWizardData(nextData)
      setAnsweredQuestionIds(nextAnswered)
      setSkippedQuestionIds(nextSkipped)
      await persistWizardData(nextData, {
        skippedIds: nextSkipped,
        answeredCount: nextAnswered.size,
        totalCount: refreshedQuestions.length,
      })

      let nextQuestion = findNextPendingQuestion(refreshedQuestions, nextAnswered, nextData, nextSkipped)

      if (currentQuestion.field.id === "p1_no_home_address") {
        const noHomeAddress = nextData.contact.p1_no_home_address === true

        if (noHomeAddress) {
          const mailingStreetQuestion = refreshedQuestions.find(
            (question) =>
              question.scope === "contact" &&
              question.field.id === "p1_mail_street" &&
              !nextAnswered.has(question.id),
          )

          if (mailingStreetQuestion) {
            nextQuestion = mailingStreetQuestion
          }
        } else {
          const homeStreetQuestion = refreshedQuestions.find(
            (question) =>
              question.scope === "contact" &&
              question.field.id === "p1_home_street" &&
              !nextAnswered.has(question.id),
          )

          if (homeStreetQuestion) {
            nextQuestion = homeStreetQuestion
          }
        }
      }

      if (!nextQuestion) {
        await completeIntakeAndOpenVerification(
          nextData,
          refreshedQuestions,
          nextAnswered,
          nextSkipped,
          copy.complete,
        )
        return
      }

      await appendAssistantQuestion(buildAcknowledgementPrefix(copy.savedPrefix, nextData), nextQuestion)
    } catch (error) {
      console.error("Intake submit error:", error)
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content: "Something went wrong processing your answer. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeStarted, currentQuestion, wizardData, skippedQuestionIds, copy, applicationTypeLabel, dispatch, persistWizardData, appendAssistantQuestion, localizeQuestion, profilePrefillMode, userProfile, completeIntakeAndOpenVerification])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.trim() || isLoading) return
    const answer = draft.trim()
    setDraft("")
    await handleAnswer(answer)
  }

  const handleWidgetAnswer = useCallback(async (value: string) => {
    if (!value.trim() || isLoading) return
    setDraft("")
    await handleAnswer(value)
  }, [isLoading, handleAnswer])

  const handleEditAnswer = useCallback(
    async (questionId: string) => {
      const question = questions.find((q) => q.id === questionId)
      if (!question) return
      setCurrentQuestionId(questionId)
      await appendAssistantQuestion("Let me re-ask:", question)
    },
    [appendAssistantQuestion, questions],
  )

  const handleResetChat = () => {
    const resetData = createInitialIntakeData()
    setWizardData(resetData)
    setAnsweredQuestionIds(new Set())
    setSkippedQuestionIds(new Set())
    setIntakeStarted(false)
    setCurrentQuestionId(null)
    setMessages([])
    setDraft("")
    setProfilePrefillMode("declined")
    translationCacheRef.current.clear()
  }

  const completionPercent = useMemo(() => {
    const total = questions.length
    if (total === 0) return 0
    return Math.round((answeredQuestionIds.size / total) * 100)
  }, [answeredQuestionIds.size, questions.length])

  const widgetSpec = useMemo((): WidgetSpec | null => {
    if (!currentQuestion || !intakeStarted) return null
    const { field } = currentQuestion
    if (field.type === "checkbox") return { kind: "yes_no" }
    if (field.type === "date") return { kind: "date" }
    if (field.type === "phone") return { kind: "phone" }
    if (field.type === "ssn") return { kind: "ssn" }
    if (field.type === "checkbox_group" && field.options?.length) {
      return { kind: "multi_select", options: field.options }
    }
    if ((field.type === "radio" || field.type === "select") && field.options?.length) {
      return { kind: "single_select", options: field.options }
    }
    if (field.id === "ethnicity") {
      return {
        kind: "single_select",
        options: ["Hispanic or Latino", "Not Hispanic or Latino", "Choose not to answer"],
      }
    }
    return null
  }, [currentQuestion, intakeStarted])

  const currentWizardStateForDialog = useMemo<WizardState>(
    () => createDraftWizardState(wizardData),
    [wizardData],
  )

  const handleSaveAndExitClick = useCallback(() => {
    setSaveExitDialogOpen(true)
  }, [])

  return (
    <>
    <IntakeChatPanel
      copy={copy}
      onSaveAndExit={handleSaveAndExitClick}
      onSwitchToWizard={onSwitchToWizard}
      autoSpeak={autoSpeak}
      onAutoSpeakChange={setAutoSpeak}
      selectedLanguage={selectedLanguage}
      onLanguageChange={handleLanguageChange}
      messages={messages}
      isLoading={isLoading}
      completionPercent={completionPercent}
      onSpeakQuestion={speakText}
      bottomAnchorRef={bottomAnchorRef}
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={handleSubmit}
      disableInput={isLoading || (intakeStarted && !currentQuestion && profilePrefillMode !== "pending")}
      disableSubmit={isLoading || !draft.trim() || (intakeStarted && !currentQuestion && profilePrefillMode !== "pending")}
      onResetChat={handleResetChat}
      collectedSections={collectedSections}
      onEditAnswer={handleEditAnswer}
      widgetSpec={widgetSpec}
      onWidgetAnswer={handleWidgetAnswer}
      widgetKey={currentQuestionId ?? undefined}
    />
    {resolvedApplicationId && (
      <PhiSaveExitDialog
        open={saveExitDialogOpen}
        applicationId={resolvedApplicationId}
        wizardState={currentWizardStateForDialog}
        actingForPatientId={actingForPatientId}
        onExit={() => {
          setSaveExitDialogOpen(false)
          if (onSaveAndExit) {
            onSaveAndExit()
          } else {
            router.back()
          }
        }}
        onCancel={() => setSaveExitDialogOpen(false)}
      />
    )}
    </>
  )
}
