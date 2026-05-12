/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ChatMessage } from "@/lib/masshealth/types"
import { extractFormFields } from "@/lib/masshealth/form-field-extraction"
import { generateText } from "ai"

vi.mock("ai", () => ({
  generateText: vi.fn(),
}))

vi.mock("@/lib/server/counters", () => ({
  incrementCounter: vi.fn(),
}))

const messages: ChatMessage[] = [
  { role: "assistant", content: "What is your home street address?" },
  { role: "user", content: "290 Congress St, Boston, MA 02210" },
]

describe("extractFormFields", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("splits a full address returned as one extracted address field", async () => {
    vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify({
      address: "290 Congress St, Boston, MA 02210",
    }) } as Awaited<ReturnType<typeof generateText>>)

    const result = await extractFormFields(messages, "", "contact", [], [], "en")

    expect(result.fields).toMatchObject({
      address: "290 Congress St",
      city: "Boston",
      state: "MA",
      zip: "02210",
    })
  })

  it("extracts full address deterministically when Ollama is unavailable", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("AI service not running"))

    const result = await extractFormFields(messages, "", "contact", [], [], "en")

    expect(result.extractionFailed).toBe(true)
    expect(result.fields).toEqual({
      address: "290 Congress St",
      city: "Boston",
      state: "MA",
      zip: "02210",
    })
  })
})
