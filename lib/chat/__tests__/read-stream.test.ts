/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tests for the AI SDK v6 UI message stream reader.
 *
 * Each test builds a mock Response whose body is a ReadableStream of
 * SSE-formatted text (matching what createUIMessageStreamResponse emits),
 * then asserts on the text and annotation returned by readChatStream.
 */

import { describe, expect, it, vi } from "vitest"
import { readChatStream } from "@/lib/chat/read-stream"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Encode a plain object as a single SSE event: "data: <json>\n\n" */
function sseEvent(chunk: Record<string, unknown>): string {
  return `data: ${JSON.stringify(chunk)}\n\n`
}

/** Build a mock streaming Response from an array of SSE event strings. */
function makeStreamResponse(events: string[]): Response {
  const body = events.join("")
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

/** Collect all tokens passed to onToken in order. */
function tokenCollector() {
  const tokens: string[] = []
  const onToken = (token: string) => tokens.push(token)
  return { tokens, onToken }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("readChatStream", () => {
  it("accumulates text-delta chunks into full text", async () => {
    const response = makeStreamResponse([
      sseEvent({ type: "start" }),
      sseEvent({ type: "text-start", id: "t1" }),
      sseEvent({ type: "text-delta", id: "t1", delta: "Hello" }),
      sseEvent({ type: "text-delta", id: "t1", delta: " world" }),
      sseEvent({ type: "text-end", id: "t1" }),
      sseEvent({ type: "finish", finishReason: "stop" }),
    ])

    const { text, annotation } = await readChatStream(response, () => {})

    expect(text).toBe("Hello world")
    expect(annotation).toBeNull()
  })

  it("calls onToken for each delta with the accumulated text so far", async () => {
    const response = makeStreamResponse([
      sseEvent({ type: "text-delta", id: "t1", delta: "A" }),
      sseEvent({ type: "text-delta", id: "t1", delta: "B" }),
      sseEvent({ type: "text-delta", id: "t1", delta: "C" }),
    ])

    const calls: [string, string][] = []
    await readChatStream(response, (token, accumulated) => {
      calls.push([token, accumulated])
    })

    expect(calls).toEqual([
      ["A", "A"],
      ["B", "AB"],
      ["C", "ABC"],
    ])
  })

  it("extracts the first data-masshealth annotation", async () => {
    const eligibilityResults = { fplPercent: 120, results: [] }
    const response = makeStreamResponse([
      sseEvent({
        type: "data-masshealth",
        data: { ok: true, outOfScope: false, eligibilityResults },
      }),
      sseEvent({ type: "text-delta", id: "t1", delta: "You qualify." }),
    ])

    const { text, annotation } = await readChatStream(response, () => {})

    expect(text).toBe("You qualify.")
    expect(annotation).toMatchObject({ ok: true, outOfScope: false, eligibilityResults })
  })

  it("returns annotation with embedded reply for out-of-scope responses (no text stream)", async () => {
    const response = makeStreamResponse([
      sseEvent({
        type: "data-masshealth",
        data: { ok: true, outOfScope: true, reply: "I can only help with MassHealth topics." },
      }),
      sseEvent({ type: "finish" }),
    ])

    const { text, annotation } = await readChatStream(response, () => {})

    expect(text).toBe("")
    expect(annotation?.outOfScope).toBe(true)
    expect(annotation?.reply).toBe("I can only help with MassHealth topics.")
  })

  it("returns only the first annotation when multiple data chunks are sent", async () => {
    const response = makeStreamResponse([
      sseEvent({ type: "data-masshealth", data: { ok: true, first: true } }),
      sseEvent({ type: "data-masshealth", data: { ok: true, second: true } }),
    ])

    const { annotation } = await readChatStream(response, () => {})

    expect(annotation).toMatchObject({ first: true })
    expect(annotation).not.toHaveProperty("second")
  })

  it("throws when the stream contains an error chunk", async () => {
    const response = makeStreamResponse([
      sseEvent({ type: "text-delta", id: "t1", delta: "Par" }),
      sseEvent({ type: "error", errorText: "Ollama timed out" }),
    ])

    await expect(readChatStream(response, () => {})).rejects.toThrow("Ollama timed out")
  })

  it("ignores non-data SSE lines (event:, id:, comments)", async () => {
    // Manually craft an SSE event with an extra "event:" line
    const rawEvent =
      "event: message\n" +
      `data: ${JSON.stringify({ type: "text-delta", id: "t1", delta: "Hi" })}\n\n`

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(rawEvent))
        controller.close()
      },
    })
    const response = new Response(stream, { status: 200 })

    const { text } = await readChatStream(response, () => {})
    expect(text).toBe("Hi")
  })

  it("handles chunks arriving in multiple reads (partial buffering)", async () => {
    // Split the SSE payload across multiple controller.enqueue calls
    // to simulate network chunking.
    const event1 = sseEvent({ type: "text-delta", id: "t1", delta: "Hello" })
    const event2 = sseEvent({ type: "text-delta", id: "t1", delta: " streaming" })
    const full = event1 + event2
    const midpoint = Math.floor(full.length / 2)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(full.slice(0, midpoint)))
        controller.enqueue(new TextEncoder().encode(full.slice(midpoint)))
        controller.close()
      },
    })
    const response = new Response(stream, { status: 200 })

    const { text } = await readChatStream(response, () => {})
    expect(text).toBe("Hello streaming")
  })

  it("handles empty text-delta gracefully", async () => {
    const response = makeStreamResponse([
      sseEvent({ type: "text-delta", id: "t1", delta: "" }),
      sseEvent({ type: "text-delta", id: "t1", delta: "Real content" }),
    ])

    const { tokens } = tokenCollector()
    const { text } = await readChatStream(response, (token) => {
      if (token) tokens.push(token)
    })

    expect(text).toBe("Real content")
    // Empty delta should not trigger onToken
    expect(tokens).toEqual(["Real content"])
  })

  it("skips malformed JSON lines without throwing", async () => {
    // Inject a broken line between valid events
    const body =
      sseEvent({ type: "text-delta", id: "t1", delta: "Good" }) +
      "data: {broken json}\n\n" +
      sseEvent({ type: "text-delta", id: "t1", delta: " data" })

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body))
        controller.close()
      },
    })
    const response = new Response(stream, { status: 200 })

    const { text } = await readChatStream(response, () => {})
    expect(text).toBe("Good data")
  })

  it("throws when response body is null", async () => {
    // Simulate a response with no body (e.g. network error)
    const response = new Response(null, { status: 200 })

    await expect(readChatStream(response, () => {})).rejects.toThrow("Response body is missing")
  })

  it("extracts extractedFields from a form-assistant annotation", async () => {
    const extractedFields = { firstName: "Maria", lastName: "Rossi" }
    const response = makeStreamResponse([
      sseEvent({
        type: "data-masshealth",
        data: { ok: true, extractedFields, noHouseholdMembers: false, noIncome: false },
      }),
      sseEvent({ type: "text-delta", id: "t1", delta: "Great, I have your name." }),
    ])

    const { text, annotation } = await readChatStream(response, () => {})

    expect(text).toBe("Great, I have your name.")
    expect(annotation?.extractedFields).toEqual(extractedFields)
    expect(annotation?.noHouseholdMembers).toBe(false)
  })
})
