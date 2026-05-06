/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ChatMessage } from "@/lib/masshealth/types"
import { extractFormFields } from "@/lib/masshealth/form-field-extraction"
import { callOllama } from "@/lib/masshealth/ollama-client"

vi.mock("@/lib/masshealth/ollama-client", () => ({
  callOllama: vi.fn(),
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
    vi.mocked(callOllama).mockResolvedValue(JSON.stringify({
      address: "290 Congress St, Boston, MA 02210",
    }))

    const result = await extractFormFields(messages, "", "contact", [], [], "en")

    expect(result.fields).toMatchObject({
      address: "290 Congress St",
      city: "Boston",
      state: "MA",
      zip: "02210",
    })
  })

  it("extracts full address deterministically when Ollama is unavailable", async () => {
    vi.mocked(callOllama).mockRejectedValue(new Error("Ollama not running"))

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
