/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import 'server-only'

import { logServerError } from '@/lib/server/logger'
import type { HelpCategory } from './constants'
import { HELP_CATEGORIES } from './constants'

const WHISPER_BASE_URL = process.env.WHISPER_BASE_URL ?? 'http://localhost:9000'
const OLLAMA_BASE_URL  = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '')
const OLLAMA_MODEL     = process.env.OLLAMA_MODEL ?? 'llama3.2'

// ── Whisper transcription ─────────────────────────────────────────────────────

interface WhisperResponse {
  text: string
  language?: string
}

export async function transcribeVoice(audioFile: File): Promise<string> {
  const form = new FormData()
  form.append('audio_file', audioFile)

  const res = await fetch(
    `${WHISPER_BASE_URL}/asr?task=transcribe&language=en&output=json`,
    { method: 'POST', body: form },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Whisper ASR failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as WhisperResponse
  return (data.text ?? '').trim()
}

// ── Ollama classification ─────────────────────────────────────────────────────

interface OllamaChatResponse {
  message?: { content?: string }
}

export async function classifyQuestion(
  title: string,
  body: string | null,
): Promise<HelpCategory> {
  const content = [title, body].filter(Boolean).join('\n\n')

  const schema = {
    type: 'object',
    properties: {
      category: { type: 'string', enum: [...HELP_CATEGORIES] },
    },
    required: ['category'],
  }

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: schema,
        messages: [
          {
            role: 'system',
            content:
              'You classify healthcare questions into exactly one category. ' +
              'Respond only with the JSON schema provided. ' +
              'Categories: eligibility (who qualifies for MassHealth), ' +
              'benefits_coverage (what is covered), ' +
              'applications_appeals (applying or appealing decisions), ' +
              'platform_help (how to use this website/app), ' +
              'other (anything else).',
          },
          { role: 'user', content },
        ],
      }),
    })

    if (!res.ok) throw new Error(`Ollama classify: ${res.status}`)
    const data = (await res.json()) as OllamaChatResponse
    const parsed = JSON.parse(data.message?.content ?? '{}') as { category?: string }
    const cat = parsed.category

    if (cat && (HELP_CATEGORIES as readonly string[]).includes(cat)) {
      return cat as HelpCategory
    }
  } catch (err) {
    logServerError('classifyQuestion failed, defaulting to other', err)
  }

  return 'other'
}

// ── Ollama embeddings ─────────────────────────────────────────────────────────

interface OllamaEmbeddingsResponse {
  embedding: number[]
}

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ollama embed failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as OllamaEmbeddingsResponse
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Ollama embed returned empty embedding')
  }
  return data.embedding
}
