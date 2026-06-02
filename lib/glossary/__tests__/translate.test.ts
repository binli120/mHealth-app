import { describe, it, expect, vi } from "vitest"
import { generateTranslation } from "../translate"

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "El deducible es la cantidad que usted paga." }],
      }),
    },
  })),
}))

describe("generateTranslation", () => {
  it("returns translated text from Claude", async () => {
    const result = await generateTranslation(
      "deductible",
      "Deductible",
      "The amount you pay before insurance pays.",
      "es"
    )
    expect(result).toBe("El deducible es la cantidad que usted paga.")
  })

  it("returns null when Anthropic throws", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk")
    const MockAnthropicCtor = Anthropic as unknown as ReturnType<typeof vi.fn>
    MockAnthropicCtor.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error("API error")),
      },
    }))
    const result = await generateTranslation("deductible", "Deductible", "...", "zh-CN")
    expect(result).toBeNull()
  })
})
