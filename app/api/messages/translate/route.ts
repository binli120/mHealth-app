/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * POST /api/messages/translate
 * Translate a voice message transcription to English using Ollama (llama3.2).
 *
 * Body: { text: string; lang: string }
 * Response: { ok: true; translation: string }
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { callOllama } from "@/lib/masshealth/ollama-client"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json().catch(() => null)
    const text = typeof body?.text === "string" ? body.text.trim() : ""
    const lang = typeof body?.lang === "string" ? body.lang.trim() : ""

    if (!text) {
      return NextResponse.json({ ok: false, error: "text is required." }, { status: 400 })
    }

    const translation = await callOllama({
      model: "llama3.2",
      temperature: 0.1,
      timeoutMs: 30_000,
      systemPrompt:
        "You are a professional translator. Translate the given text to English. " +
        "Output ONLY the translated text — no explanations, no quotes, no extra words.",
      messages: [
        {
          role: "user",
          content: lang
            ? `Translate the following ${lang} text to English:\n\n${text}`
            : `Translate the following text to English:\n\n${text}`,
        },
      ],
    })

    return NextResponse.json({ ok: true, translation: translation.trim() })
  } catch (error) {
    logServerError("POST /api/messages/translate failed", error, {
      module: "api/messages/translate",
    })
    return NextResponse.json({ ok: false, error: "Translation failed." }, { status: 500 })
  }
}
