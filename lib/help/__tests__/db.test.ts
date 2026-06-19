/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only and the DB pool before importing db.ts
vi.mock('server-only', () => ({}))

const mockQuery = vi.fn()
vi.mock('@/lib/db/server', () => ({
  getDbPool: () => ({ query: mockQuery }),
}))

const {
  listHelpQuestions,
  getHelpQuestion,
  createHelpQuestion,
  updateHelpQuestionEmbedding,
  createHelpAnswer,
  findSimilarQuestions,
  setNotifyOnAnswer,
  getQuestionsWithNotifyForQuestion,
} = await import('../db')

// Minimal row fixtures
const QUESTION_ROW = {
  id: 'q-1',
  user_id: 'u-1',
  title: 'How do I apply?',
  body: 'I need help applying for MassHealth.',
  category: 'applications_appeals',
  voice_url: null,
  voice_file_name: null,
  file_url: null,
  file_name: null,
  notify_on_answer: true,
  answer_count: '2',
  created_at: '2026-06-18T00:00:00.000Z',
}

const ANSWER_ROW = {
  id: 'a-1',
  question_id: 'q-1',
  user_id: 'u-2',
  body: 'You can apply online at mass.gov/masshealth.',
  badge_type: 'professional' as const,
  display_name: 'Maria Santos',
  created_at: '2026-06-18T01:00:00.000Z',
}

beforeEach(() => {
  mockQuery.mockReset()
})

// ── listHelpQuestions ─────────────────────────────────────────────────────────

describe('listHelpQuestions', () => {
  it('returns mapped questions on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [QUESTION_ROW] })

    const result = await listHelpQuestions({})
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('q-1')
    expect(result[0].answerCount).toBe(2)
    expect(result[0].category).toBe('applications_appeals')
  })

  it('returns empty array when no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await listHelpQuestions({})
    expect(result).toEqual([])
  })

  it('adds category WHERE clause when category provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listHelpQuestions({ category: 'eligibility' })
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/category = \$/)
    expect(params).toContain('eligibility')
  })

  it('adds search WHERE clause when q provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listHelpQuestions({ q: 'dental' })
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/ILIKE|similarity/)
    expect(params).toContain('dental')
  })

  it('uses default limit 20 and offset 0', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await listHelpQuestions({})
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(params[0]).toBe(20)
    expect(params[1]).toBe(0)
  })
})

// ── getHelpQuestion ───────────────────────────────────────────────────────────

describe('getHelpQuestion', () => {
  it('returns question with answers', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [QUESTION_ROW] })
      .mockResolvedValueOnce({ rows: [ANSWER_ROW] })

    const result = await getHelpQuestion('q-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('q-1')
    expect(result!.answers).toHaveLength(1)
    expect(result!.answers[0].badgeType).toBe('professional')
    expect(result!.answers[0].displayName).toBe('Maria Santos')
  })

  it('returns null when question not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await getHelpQuestion('nonexistent')
    expect(result).toBeNull()
  })

  it('returns question with empty answers array when no answers', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [QUESTION_ROW] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await getHelpQuestion('q-1')
    expect(result!.answers).toEqual([])
  })
})

// ── createHelpQuestion ────────────────────────────────────────────────────────

describe('createHelpQuestion', () => {
  it('inserts and returns the new question', async () => {
    const returnedRow = { ...QUESTION_ROW, answer_count: '0' }
    mockQuery.mockResolvedValueOnce({ rows: [returnedRow] })

    const result = await createHelpQuestion({
      userId: 'u-1',
      title: 'How do I apply?',
      body: null,
      category: 'applications_appeals',
      voiceUrl: null,
      fileUrl: null,
      fileName: null,
      notifyOnAnswer: true,
    })

    expect(result.id).toBe('q-1')
    expect(result.answerCount).toBe(0)
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/INSERT INTO/)
  })
})

// ── findSimilarQuestions ──────────────────────────────────────────────────────

describe('findSimilarQuestions', () => {
  it('returns similar questions above threshold', async () => {
    const similarRow = {
      id: 'q-2',
      title: 'How to apply for MassHealth?',
      category: 'applications_appeals',
      answer_count: '1',
    }
    mockQuery.mockResolvedValueOnce({ rows: [similarRow] })

    const embedding = new Array(768).fill(0.1)
    const result = await findSimilarQuestions(embedding)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('q-2')
    expect(result[0].answerCount).toBe(1)
  })

  it('passes excludeId when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const embedding = new Array(768).fill(0.1)
    await findSimilarQuestions(embedding, 'q-exclude')
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/hq\.id\s*(?:!=|<>)\s*\$/)
    expect(params).toContain('q-exclude')
  })

  it('returns empty array when no similar questions found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await findSimilarQuestions(new Array(768).fill(0))
    expect(result).toEqual([])
  })
})

// ── updateHelpQuestionEmbedding ───────────────────────────────────────────────

describe('updateHelpQuestionEmbedding', () => {
  it('issues UPDATE with serialised embedding vector', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await updateHelpQuestionEmbedding('q-1', [0.1, 0.2, 0.3])
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/UPDATE.*help_questions.*embedding/i)
    expect(params[0]).toBe('[0.1,0.2,0.3]')
    expect(params[1]).toBe('q-1')
  })
})

// ── createHelpAnswer ──────────────────────────────────────────────────────────

describe('createHelpAnswer', () => {
  it('inserts and returns the new answer', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [ANSWER_ROW] })
    const result = await createHelpAnswer({
      questionId: 'q-1',
      userId: 'u-2',
      body: 'You can apply online.',
    })
    expect(result.id).toBe('a-1')
    expect(result.displayName).toBe('Maria Santos')
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/INSERT INTO public\.help_answers/i)
  })
})

// ── getQuestionsWithNotifyForQuestion ─────────────────────────────────────────

describe('getQuestionsWithNotifyForQuestion', () => {
  it('returns userId and email for questions with notify=true', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'u-1', email: 'user@example.com' }],
    })
    const result = await getQuestionsWithNotifyForQuestion('q-1')
    expect(result).toEqual([{ userId: 'u-1', email: 'user@example.com' }])
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/notify_on_answer/i)
    expect(params).toContain('q-1')
  })

  it('returns empty array when no subscribers', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const result = await getQuestionsWithNotifyForQuestion('q-no-notify')
    expect(result).toEqual([])
  })
})

// ── setNotifyOnAnswer ─────────────────────────────────────────────────────────

describe('setNotifyOnAnswer', () => {
  it('updates notify_on_answer for the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await setNotifyOnAnswer('u-1', false)
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/UPDATE.*help_questions/i)
    expect(params).toContain(false)
    expect(params).toContain('u-1')
  })

  it('does not throw on empty result', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    await expect(setNotifyOnAnswer('u-no-questions', true)).resolves.toBeUndefined()
  })
})
