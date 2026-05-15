import { describe, it, expect } from "vitest"
import {
  buildIntakeQuestions,
  computeAnsweredIntakeQuestionIds,
  createInitialIntakeData,
  findNextPendingIntakeQuestion,
  parseIntakeAnswerValue,
  writeIntakeQuestionValue,
} from "@/components/application/aca3/intake-chat"
import type { WizardData } from "@/components/application/aca3/intake-chat-types"

describe("language question flow", () => {
  it("lists first 15 questions from initial state", () => {
    const data = createInitialIntakeData()
    const questions = buildIntakeQuestions(data)
    const answered = computeAnsweredIntakeQuestionIds(questions, data)
    
    console.log("Initial answered:", [...answered])
    console.log("First 15 questions:")
    questions.slice(0, 15).forEach((q, i) => {
      const isAnswered = answered.has(q.id)
      console.log(`  [${i}] ${q.id} (${q.field.required ? "required" : "optional"}) ${isAnswered ? "✓ ANSWERED" : ""}`)
    })
    
    const firstPending = findNextPendingIntakeQuestion(questions, answered, data, new Set())
    console.log("First pending question:", firstPending?.field.id)
  })

  it("simulates walking through every question until p1_language_spoken then checks next", () => {
    let data = createInitialIntakeData()
    let skipped = new Set<string>()
    let answeredIds = computeAnsweredIntakeQuestionIds(buildIntakeQuestions(data), data)
    
    const DECLINE_ANSWERS: Record<string, string> = {
      p1_other_phone: "skip",
      p1_email: "skip",
      p1_home_apt: "skip",
      p1_home_county: "skip",
    }
    
    const YES_NO_ANSWERS: Record<string, string> = {
      p1_no_home_address: "Yes",  // has home address
      p1_mailing_same: "Yes",      // same as home
    }
    
    const FIELD_ANSWERS: Record<string, string> = {
      p1_name: "John Smith",
      p1_dob: "01/01/1980",
      p1_home_street: "123 Main St",
      p1_home_city: "Boston",
      p1_home_state: "MA",
      p1_home_zip: "02101",
      p1_phone: "6175551234",
      p1_num_people: "1",
      p1_language_spoken: "Spanish",
    }
    
    let iteration = 0
    
    while (iteration < 30) {
      iteration++
      const questions = buildIntakeQuestions(data)
      const nextQ = findNextPendingIntakeQuestion(questions, answeredIds, data, skipped)
      
      if (!nextQ) {
        console.log(`No more questions after ${iteration} iterations`)
        break
      }
      
      const fid = nextQ.field.id
      console.log(`[${iteration}] Answering: ${fid} - "${nextQ.field.label.slice(0,50)}"`)
      
      if (fid === "p1_language_spoken") {
        // After answering this, check the next
        const parsed = parseIntakeAnswerValue(nextQ.field, "Spanish")
        const nextData = writeIntakeQuestionValue(data, nextQ, parsed)
        const refreshedQs = buildIntakeQuestions(nextData)
        const nextAnswered = computeAnsweredIntakeQuestionIds(refreshedQs, nextData)
        const nextSkipped = new Set(skipped)
        nextSkipped.delete(nextQ.id) // filled value
        const afterLang = findNextPendingIntakeQuestion(refreshedQs, nextAnswered, nextData, nextSkipped)
        console.log("NEXT after p1_language_spoken:", afterLang?.field.id, "-", afterLang?.field.label?.slice(0,50))
        expect(afterLang).not.toBeNull()
        // p1_language_written is auto-skipped (mirrored from p1_language_spoken)
        expect(afterLang?.field.id).not.toBe("p1_language_written")
        return
      }
      
      let answer = FIELD_ANSWERS[fid] ?? YES_NO_ANSWERS[fid] ?? DECLINE_ANSWERS[fid] ?? "test answer"
      const parsed = parseIntakeAnswerValue(nextQ.field, answer)
      const isFilled = typeof parsed === "string" ? parsed.trim().length > 0 : parsed !== null && parsed !== undefined
      const declineWords = new Set(["skip", "no"])
      const isDecline = declineWords.has(answer.toLowerCase())
      
      data = writeIntakeQuestionValue(data, nextQ, parsed)
      const newSkipped = new Set(skipped)
      if (!nextQ.field.required && isDecline && !isFilled) {
        newSkipped.add(nextQ.id)
      }
      skipped = newSkipped
      
      const questions2 = buildIntakeQuestions(data)
      answeredIds = computeAnsweredIntakeQuestionIds(questions2, data)
    }
    
    expect.fail("Did not reach p1_language_spoken")
  })
})
