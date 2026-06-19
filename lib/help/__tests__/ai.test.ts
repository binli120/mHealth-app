/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Must import after stubbing
const { transcribeVoice, classifyQuestion, embedText } = await import('../ai')

describe('transcribeVoice', () => {
  it('returns transcript text from Whisper response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: '  Hello world  ', language: 'en' }),
    })

    const file = new File(['audio'], 'test.webm', { type: 'audio/webm' })
    const result = await transcribeVoice(file)
    expect(result).toBe('Hello world')

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit & { body: FormData }]
    expect(url).toContain('/asr')
    expect(url).toContain('task=transcribe')
    expect(opts.method).toBe('POST')
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'unavailable' })
    const file = new File(['audio'], 'test.webm', { type: 'audio/webm' })
    await expect(transcribeVoice(file)).rejects.toThrow('Whisper ASR failed: 503')
  })
})

describe('classifyQuestion', () => {
  beforeEach(() => fetchMock.mockReset())

  it('returns parsed category from Ollama', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: '{"category":"eligibility"}' } }),
    })
    const result = await classifyQuestion('Am I eligible?', null)
    expect(result).toBe('eligibility')
  })

  it('defaults to other on bad response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: '{"category":"nonsense"}' } }),
    })
    const result = await classifyQuestion('Question', null)
    expect(result).toBe('other')
  })

  it('defaults to other on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    const result = await classifyQuestion('Question', null)
    expect(result).toBe('other')
  })
})

describe('embedText', () => {
  beforeEach(() => fetchMock.mockReset())

  it('returns embedding array', async () => {
    const embedding = Array.from({ length: 768 }, (_, i) => i * 0.001)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding }),
    })
    const result = await embedText('test text')
    expect(result).toHaveLength(768)
    expect(result[0]).toBeCloseTo(0)
  })

  it('throws on empty embedding', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: [] }),
    })
    await expect(embedText('test')).rejects.toThrow('empty embedding')
  })
})
