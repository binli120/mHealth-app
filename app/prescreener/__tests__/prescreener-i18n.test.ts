import { describe, expect, it } from "vitest"
import { runEligibilityCheck, type ScreenerData } from "@/lib/eligibility-engine"
import { getPrescreenerSteps } from "@/app/prescreener/prescreener-copy"
import { localizeEligibilityReport } from "@/app/prescreener/prescreener-results"

function makeData(overrides: Partial<ScreenerData> = {}): ScreenerData {
  return {
    livesInMA: true,
    age: 35,
    isPregnant: false,
    hasDisability: false,
    hasMedicare: false,
    householdSize: 1,
    annualIncome: 0,
    citizenshipStatus: "citizen",
    hasEmployerInsurance: false,
    ...overrides,
  }
}

describe("prescreener i18n", () => {
  it("builds localized intake steps for Spanish", () => {
    const steps = getPrescreenerSteps("es")

    expect(steps[0]?.botMessage).toContain("¡Hola!")
    expect(steps[0]?.quickReplies?.map((reply) => reply.label)).toEqual([
      "Massachusetts",
      "Otro estado",
    ])
  })

  it("localizes eligibility results for Spanish", () => {
    const data = makeData({ annualIncome: 15060 })
    const report = runEligibilityCheck(data)
    const localized = localizeEligibilityReport(report, data, "es")

    expect(localized.summary).toContain("Según sus respuestas")
    expect(localized.results[0]?.program).toBe("MassHealth CarePlus")
    expect(localized.results[0]?.tagline).toContain("podría haber Medicaid gratuito")
    expect(localized.results[0]?.actionLabel).toBe("Solicitar Ahora")
  })

  it("localizes the out-of-state result for Chinese", () => {
    const data = makeData({ livesInMA: false })
    const report = runEligibilityCheck(data)
    const localized = localizeEligibilityReport(report, data, "zh-CN")

    expect(localized.summary).toBe("MassHealth 仅适用于马萨诸塞州居民。")
    expect(localized.results[0]?.program).toBe("不符合 MassHealth 资格")
    expect(localized.results[0]?.actionLabel).toBe("访问 healthcare.gov")
  })
})
