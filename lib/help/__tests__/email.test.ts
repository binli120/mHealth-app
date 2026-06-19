/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockSend = vi.fn()
vi.mock('@/lib/resend', () => ({
  resend: { emails: { send: mockSend } },
}))

vi.mock('@/lib/server/logger', () => ({
  logServerInfo: vi.fn(),
  logServerError: vi.fn(),
}))

const { sendNewQuestionEmail } = await import('../email')

const QUESTION = {
  id: 'q-1',
  userId: 'u-1',
  title: 'How do I renew my MassHealth?',
  body: 'My coverage expires next month.',
  category: 'applications_appeals' as const,
  voiceUrl: null,
  voiceFileName: null,
  fileUrl: null,
  fileName: null,
  notifyOnAnswer: true,
  answerCount: 0,
  createdAt: '2026-06-18T00:00:00.000Z',
}

beforeEach(() => {
  mockSend.mockReset()
})

describe('sendNewQuestionEmail', () => {
  it('sends email with correct subject and recipient', async () => {
    mockSend.mockResolvedValueOnce({ data: {}, error: null })

    await sendNewQuestionEmail(QUESTION)

    expect(mockSend).toHaveBeenCalledOnce()
    const [payload] = mockSend.mock.calls[0] as [Record<string, unknown>]
    expect(payload.subject).toBe('[Help] How do I renew my MassHealth?')
    expect(payload.to).toBe('no-reply@healthcompass.cloud')
  })

  it('includes question title and body in the HTML', async () => {
    mockSend.mockResolvedValueOnce({ data: {}, error: null })

    await sendNewQuestionEmail(QUESTION)

    const [payload] = mockSend.mock.calls[0] as [Record<string, unknown>]
    expect(payload.html).toContain('How do I renew my MassHealth?')
    expect(payload.html).toContain('My coverage expires next month.')
  })

  it('includes a link to the question', async () => {
    mockSend.mockResolvedValueOnce({ data: {}, error: null })

    await sendNewQuestionEmail(QUESTION)

    const [payload] = mockSend.mock.calls[0] as [Record<string, unknown>]
    expect(payload.html).toContain('/help/q-1')
  })

  it('escapes HTML in title and body to prevent injection', async () => {
    mockSend.mockResolvedValueOnce({ data: {}, error: null })

    await sendNewQuestionEmail({
      ...QUESTION,
      title: '<script>alert("xss")</script>',
      body: '<img src=x onerror=alert(1)>',
    })

    const [payload] = mockSend.mock.calls[0] as [Record<string, unknown>]
    expect(payload.html).not.toContain('<script>')
    expect(payload.html).toContain('&lt;script&gt;')
    expect(payload.html).not.toContain('<img')
  })

  it('truncates body longer than 300 characters', async () => {
    mockSend.mockResolvedValueOnce({ data: {}, error: null })
    const longBody = 'a'.repeat(400)

    await sendNewQuestionEmail({ ...QUESTION, body: longBody })

    const [payload] = mockSend.mock.calls[0] as [Record<string, unknown>]
    expect(payload.html).toContain('…')
    expect((payload.html as string).indexOf('a'.repeat(301))).toBe(-1)
  })

  it('renders fallback text when body is null', async () => {
    mockSend.mockResolvedValueOnce({ data: {}, error: null })

    await sendNewQuestionEmail({ ...QUESTION, body: null })

    const [payload] = mockSend.mock.calls[0] as [Record<string, unknown>]
    expect(payload.html).toContain('no details provided')
  })

  it('swallows errors — does not throw on send failure', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    // Must not throw
    await expect(sendNewQuestionEmail(QUESTION)).resolves.toBeUndefined()
  })

  it('swallows Resend API errors returned in the error field', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'rate limit' } })

    await expect(sendNewQuestionEmail(QUESTION)).resolves.toBeUndefined()
  })
})
