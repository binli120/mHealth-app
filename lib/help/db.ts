import 'server-only'

import { getDbPool } from '@/lib/db/server'
import type { HelpCategory } from './constants'
import { SIMILARITY_THRESHOLD, SIMILAR_QUESTIONS_LIMIT } from './constants'
import type { BadgeType, HelpAnswer, HelpQuestion, HelpQuestionDetail, SimilarQuestion } from './types'

// ── Row types ─────────────────────────────────────────────────────────────────

interface QuestionRow {
  id: string
  user_id: string
  title: string
  body: string | null
  category: string
  voice_url: string | null
  voice_file_name: string | null
  file_url: string | null
  file_name: string | null
  notify_on_answer: boolean
  answer_count: string
  created_at: string
}

interface AnswerRow {
  id: string
  question_id: string
  user_id: string
  body: string
  badge_type: BadgeType
  display_name: string
  created_at: string
}

function rowToQuestion(row: QuestionRow): HelpQuestion {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    category: row.category as HelpCategory,
    voiceUrl: row.voice_url,
    voiceFileName: row.voice_file_name,
    fileUrl: row.file_url,
    fileName: row.file_name,
    notifyOnAnswer: row.notify_on_answer,
    answerCount: parseInt(row.answer_count, 10),
    createdAt: row.created_at,
  }
}

function rowToAnswer(row: AnswerRow): HelpAnswer {
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    body: row.body,
    badgeType: row.badge_type,
    displayName: row.display_name,
    createdAt: row.created_at,
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listHelpQuestions(opts: {
  q?: string
  category?: string
  limit?: number
  offset?: number
}): Promise<HelpQuestion[]> {
  const pool = getDbPool()
  const { q, category, limit = 20, offset = 0 } = opts

  const params: unknown[] = [limit, offset]
  let where = 'WHERE 1=1'

  if (category && category !== 'all') {
    params.push(category)
    where += ` AND hq.category = $${params.length}`
  }

  if (q) {
    params.push(q)
    where += ` AND (hq.title ILIKE '%' || $${params.length} || '%' OR similarity(hq.title, $${params.length}) > 0.1)`
  }

  const { rows } = await pool.query<QuestionRow>(
    `SELECT hq.id, hq.user_id, hq.title, hq.body, hq.category,
            hq.voice_url, hq.voice_file_name, hq.file_url, hq.file_name,
            hq.notify_on_answer, hq.created_at,
            COUNT(ha.id)::text AS answer_count
     FROM public.help_questions hq
     LEFT JOIN public.help_answers ha ON ha.question_id = hq.id
     ${where}
     GROUP BY hq.id
     ORDER BY hq.created_at DESC
     LIMIT $1 OFFSET $2`,
    params,
  )
  return rows.map(rowToQuestion)
}

export async function getHelpQuestion(id: string): Promise<HelpQuestionDetail | null> {
  const pool = getDbPool()

  const { rows: qRows } = await pool.query<QuestionRow>(
    `SELECT hq.id, hq.user_id, hq.title, hq.body, hq.category,
            hq.voice_url, hq.voice_file_name, hq.file_url, hq.file_name,
            hq.notify_on_answer, hq.created_at,
            COUNT(ha.id)::text AS answer_count
     FROM public.help_questions hq
     LEFT JOIN public.help_answers ha ON ha.question_id = hq.id
     WHERE hq.id = $1
     GROUP BY hq.id`,
    [id],
  )
  if (!qRows[0]) return null

  const { rows: aRows } = await pool.query<AnswerRow>(
    `SELECT ha.id, ha.question_id, ha.user_id, ha.body, ha.created_at,
            hub.badge_type,
            COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''), 'Community member') AS display_name
     FROM public.help_answers ha
     JOIN auth.users au ON au.id = ha.user_id
     LEFT JOIN public.help_user_badge hub ON hub.user_id = ha.user_id
     WHERE ha.question_id = $1
     ORDER BY ha.created_at ASC`,
    [id],
  )

  return { ...rowToQuestion(qRows[0]), answers: aRows.map(rowToAnswer) }
}

export async function createHelpQuestion(input: {
  userId: string
  title: string
  body: string | null
  category: HelpCategory
  voiceUrl: string | null
  voiceFileName: string | null
  fileUrl: string | null
  fileName: string | null
  notifyOnAnswer: boolean
}): Promise<HelpQuestion> {
  const pool = getDbPool()
  const { rows } = await pool.query<QuestionRow>(
    `INSERT INTO public.help_questions
       (user_id, title, body, category, voice_url, voice_file_name, file_url, file_name, notify_on_answer)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *, '0'::text AS answer_count`,
    [
      input.userId, input.title, input.body, input.category,
      input.voiceUrl, input.voiceFileName, input.fileUrl, input.fileName,
      input.notifyOnAnswer,
    ],
  )
  return rowToQuestion(rows[0])
}

export async function updateHelpQuestionEmbedding(id: string, embedding: number[]): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.help_questions SET embedding = $1 WHERE id = $2`,
    [`[${embedding.join(',')}]`, id],
  )
}

export async function createHelpAnswer(input: {
  questionId: string
  userId: string
  body: string
}): Promise<HelpAnswer> {
  const pool = getDbPool()
  const { rows } = await pool.query<AnswerRow>(
    `WITH ins AS (
       INSERT INTO public.help_answers (question_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING *
     )
     SELECT ins.id, ins.question_id, ins.user_id, ins.body, ins.created_at,
            hub.badge_type,
            COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''), 'Community member') AS display_name
     FROM ins
     JOIN auth.users au ON au.id = ins.user_id
     LEFT JOIN public.help_user_badge hub ON hub.user_id = ins.user_id`,
    [input.questionId, input.userId, input.body],
  )
  return rowToAnswer(rows[0])
}

export async function findSimilarQuestions(
  embedding: number[],
  excludeId?: string,
): Promise<SimilarQuestion[]> {
  const pool = getDbPool()
  const embStr = `[${embedding.join(',')}]`
  const params: unknown[] = [embStr, SIMILARITY_THRESHOLD, SIMILAR_QUESTIONS_LIMIT]

  let where = 'WHERE hq.embedding IS NOT NULL AND 1 - (hq.embedding <=> $1::vector) > $2'
  if (excludeId) {
    params.push(excludeId)
    where += ` AND hq.id != $${params.length}`
  }

  const { rows } = await pool.query<{
    id: string; title: string; category: string; answer_count: string
  }>(
    `SELECT hq.id, hq.title, hq.category, COUNT(ha.id)::text AS answer_count
     FROM public.help_questions hq
     LEFT JOIN public.help_answers ha ON ha.question_id = hq.id
     ${where}
     GROUP BY hq.id
     ORDER BY 1 - (hq.embedding <=> $1::vector) DESC
     LIMIT $3`,
    params,
  )
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    category: r.category as HelpCategory,
    answerCount: parseInt(r.answer_count, 10),
  }))
}

export async function setNotifyOnAnswer(userId: string, notify: boolean): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.help_questions SET notify_on_answer = $1 WHERE user_id = $2`,
    [notify, userId],
  )
}

export async function getQuestionsWithNotifyForQuestion(
  questionId: string,
): Promise<Array<{ userId: string; email: string }>> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ user_id: string; email: string }>(
    `SELECT hq.user_id, au.email
     FROM public.help_questions hq
     JOIN auth.users au ON au.id = hq.user_id
     WHERE hq.id = $1 AND hq.notify_on_answer = true AND au.email IS NOT NULL`,
    [questionId],
  )
  return rows.map(r => ({ userId: r.user_id, email: r.email }))
}
