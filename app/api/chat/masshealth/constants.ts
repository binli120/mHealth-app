export const CHAT_RUNTIME = "nodejs"

export const CHAT_MESSAGE_ROLE_USER = "user"
export const CHAT_MESSAGE_ROLE_ASSISTANT = "assistant"
export const CHAT_MESSAGE_ROLES = [CHAT_MESSAGE_ROLE_USER, CHAT_MESSAGE_ROLE_ASSISTANT] as const
export const CHAT_REQUEST_MODE_ASSISTANT = "assistant"
export const CHAT_REQUEST_MODE_APPLICATION_INTAKE = "application_intake"
export const CHAT_REQUEST_MODE_BENEFIT_ADVISOR = "benefit_advisor"
export const CHAT_REQUEST_MODES = [
  CHAT_REQUEST_MODE_ASSISTANT,
  CHAT_REQUEST_MODE_APPLICATION_INTAKE,
  CHAT_REQUEST_MODE_BENEFIT_ADVISOR,
] as const
export const CHAT_MESSAGE_CONTENT_MIN_LENGTH = 1
export const CHAT_MESSAGE_CONTENT_MAX_LENGTH = 6000

export const CHAT_REQUEST_MIN_MESSAGES = 1
export const CHAT_REQUEST_MAX_MESSAGES = 30
export const OLLAMA_MESSAGES_CONTEXT_LIMIT = 12
export const MASSHEALTH_CONVERSATION_RECENT_USER_MESSAGES = 6

export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
export const OLLAMA_CHAT_ENDPOINT = "/api/chat"
export const DEFAULT_OLLAMA_MODEL = "llama3.2"
export const OLLAMA_TIMEOUT_MS = 45_000
export const OLLAMA_TEMPERATURE = 0.2

// RAG + Benefit Advisor constants
export const OLLAMA_EMBED_MODEL = "nomic-embed-text"
export const RAG_TOP_K = 4          // number of policy chunks to retrieve
export const RAG_TOP_K_ADVISOR = 3  // fewer chunks for benefit_advisor (saves context)

export const DEFAULT_CHAT_LANGUAGE = "en"

export const ERROR_USER_MESSAGE_REQUIRED = "A user message is required."
export const ERROR_OLLAMA_RESPONSE = "Ollama returned an error."
export const ERROR_OLLAMA_EMPTY_RESPONSE = "Ollama returned an empty response."
export const ERROR_INVALID_REQUEST_PAYLOAD = "Invalid request payload."
export const ERROR_CHAT_REQUEST_FAILED = "Unable to complete chat request."
export const ERROR_LOG_PREFIX = "MassHealth chat route failed"
