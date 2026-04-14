/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Client-side reader for the AI SDK v6 UI message stream format.
 *
 * The backend returns SSE (Server-Sent Events) where each event contains a
 * JSON-encoded UIMessageChunk:
 *
 *   data: {"type":"start","messageId":"..."}\n\n
 *   data: {"type":"text-start","id":"..."}\n\n
 *   data: {"type":"text-delta","id":"...","delta":"Hello"}\n\n
 *   data: {"type":"text-end","id":"..."}\n\n
 *   data: {"type":"data-masshealth","data":{...}}\n\n
 *   data: {"type":"error","errorText":"..."}\n\n
 *   data: {"type":"finish","finishReason":"stop"}\n\n
 *
 * Usage:
 *   const response = await authenticatedFetch("/api/chat/masshealth", { ... })
 *   const { text, annotation } = await readChatStream(response, (token, full) => {
 *     setReply(full)   // update UI on every token
 *   })
 */

/** Structured metadata sent by the server via a "data-masshealth" chunk. */
export interface ChatStreamAnnotation {
  ok?: boolean
  outOfScope?: boolean
  /** Only present on out-of-scope responses (no text stream follows). */
  reply?: string
  factsExtracted?: Record<string, unknown>
  eligibilityResults?: Record<string, unknown>
  extractedFields?: Record<string, unknown>
  noHouseholdMembers?: boolean
  noIncome?: boolean
  extractionFailed?: boolean
  [key: string]: unknown
}

export interface ChatStreamResult {
  /** Full accumulated text from all `text-delta` chunks. */
  text: string
  /** First data annotation written by the server (if any). */
  annotation: ChatStreamAnnotation | null
}

/**
 * Reads an AI SDK v6 UI message stream response and calls `onToken` for every
 * text-delta chunk. Returns the full accumulated text and the first data
 * annotation written by the server.
 *
 * Throws on `error` chunks or missing response body.
 */
export async function readChatStream(
  response: Response,
  onToken: (token: string, accumulated: string) => void,
): Promise<ChatStreamResult> {
  if (!response.body) throw new Error("Response body is missing")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let accumulated = ""
  let annotation: ChatStreamAnnotation | null = null
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE events are separated by "\n\n"
      let eventEnd: number
      while ((eventEnd = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, eventEnd)
        buffer = buffer.slice(eventEnd + 2)

        // Extract the "data: " line (SSE may also have "event:" lines; skip those)
        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data: "))
        if (!dataLine) continue

        const json = dataLine.slice(6) // strip "data: "

        let chunk: { type: string; [key: string]: unknown }
        try {
          chunk = JSON.parse(json) as typeof chunk
        } catch {
          continue // malformed — skip
        }

        const { type } = chunk

        if (type === "text-delta") {
          const token = (chunk.delta as string) ?? ""
          if (token) {
            accumulated += token
            onToken(token, accumulated)
          }
        } else if (typeof type === "string" && type.startsWith("data-")) {
          // Custom data chunk emitted by writeData() on the server
          if (annotation === null) {
            annotation = (chunk.data as ChatStreamAnnotation) ?? null
          }
        } else if (type === "error") {
          throw new Error((chunk.errorText as string) ?? "Stream error")
        }
        // text-start, text-end, start, finish, start-step, finish-step — ignored
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { text: accumulated, annotation }
}
