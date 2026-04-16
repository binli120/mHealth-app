/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again."
const NETWORK_ERROR_MESSAGE =
  "We could not reach HealthCompass MA. Check your connection and try again."
const SIGN_IN_EXPIRED_MESSAGE = "Your sign-in session expired. Please sign in again."
const PERMISSION_ERROR_MESSAGE =
  "You do not have permission to do that. If this looks wrong, sign in again or contact support."
const SERVER_ERROR_MESSAGE =
  "The server had trouble completing this request. Please try again."
const INVALID_REQUEST_MESSAGE =
  "Some required information is missing or invalid. Refresh the page and try again."
const AI_SERVICE_ERROR_MESSAGE =
  "The AI service is temporarily unavailable. Please try again."

interface UserFacingErrorOptions {
  fallback?: string
  context?: "auth" | "invitation" | "verification" | "upload" | "profile" | "session" | "admin" | "ai" | "general"
}

export function toUserFacingError(
  error: unknown,
  fallbackOrOptions: string | UserFacingErrorOptions = DEFAULT_ERROR_MESSAGE,
): string {
  const options =
    typeof fallbackOrOptions === "string"
      ? { fallback: fallbackOrOptions, context: "general" as const }
      : { context: "general" as const, ...fallbackOrOptions }
  const fallback = options.fallback ?? DEFAULT_ERROR_MESSAGE
  const rawMessage = extractErrorMessage(error)
  if (!rawMessage) return fallback

  const message = stripTechnicalPrefix(rawMessage)
  const normalized = message.toLowerCase()

  if (options.context === "invitation" && normalized.includes("token")) {
    return "This invitation link is invalid or expired. Ask the admin to send a new invitation."
  }

  if (options.context === "verification" && normalized.includes("token")) {
    return "This verification link is invalid or expired. Please start a new scan from your desktop."
  }

  if (/invalid login credentials|invalid email or password|invalid credentials/.test(normalized)) {
    return "The email or password you entered does not match our records."
  }

  if (/email not confirmed|not confirmed|not verified/.test(normalized)) {
    return "Please confirm your email before signing in. Check your inbox for the confirmation link."
  }

  if (
    /invalid refresh token|refresh token not found|refresh_token_not_found|invalid token|jwt|access token|auth session missing|session expired|token.*expired/.test(
      normalized,
    )
  ) {
    return SIGN_IN_EXPIRED_MESSAGE
  }

  if (/failed to fetch|fetch failed|networkerror|network error|load failed|network request failed/.test(normalized)) {
    return NETWORK_ERROR_MESSAGE
  }

  if (/unauthorized|not authenticated|must be signed in|sign in to continue/.test(normalized)) {
    return "You must be signed in to continue."
  }

  if (/forbidden|permission denied|access denied|row-level security|rls/.test(normalized)) {
    return PERMISSION_ERROR_MESSAGE
  }

  if (/api error\s*\d{3}|http\s*\d{3}|server error\s*\d{3}|error\s*\d{3}/.test(normalized)) {
    return SERVER_ERROR_MESSAGE
  }

  if (/content is required/.test(normalized)) {
    return "Enter a message before sending."
  }

  if (/audio.*required|voice.*required/.test(normalized)) {
    return "Record a voice message before sending."
  }

  if (/no reply from assistant/.test(normalized)) {
    return "The assistant did not return a response. Please try again."
  }

  if (/ollama|embedding|model request|ai service/.test(normalized) || options.context === "ai") {
    return AI_SERVICE_ERROR_MESSAGE
  }

  if (/nppes/.test(normalized)) {
    return "Provider search is temporarily unavailable. Please try again later."
  }

  if (
    /request body|request payload|invalid request|query param|param is required|field .*required|content is required|patientuserid is required|profileid .*required|userid .*required|status is required|action required|must be a valid|must be an array|unknown action|missing/.test(
      normalized,
    )
  ) {
    return INVALID_REQUEST_MESSAGE
  }

  if (
    /duplicate key|constraint|violates|sqlstate|postgres|pgrst|supabase|database|relation .* does not exist|column .* does not exist|null value/.test(
      normalized,
    )
  ) {
    return fallback
  }

  return message || fallback
}

function extractErrorMessage(error: unknown): string | null {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (!error || typeof error !== "object") return null

  const record = error as Record<string, unknown>
  if (typeof record.error === "string") return record.error
  if (typeof record.detail === "string") return record.detail
  if (typeof record.message === "string") return record.message
  return null
}

function stripTechnicalPrefix(message: string): string {
  return message
    .trim()
    .replace(/^(AuthApiError|PostgrestError|TypeError|Error):\s*/i, "")
    .trim()
}
