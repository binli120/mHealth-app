import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/require-auth'
import { logServerError } from '@/lib/server/logger'
import { checkRateLimitAsync, helpQuestionLimiter } from '@/lib/server/rate-limit'
import { validateUpload } from '@/lib/uploads/validate'
import { uploadToStorage, STORAGE_BUCKET } from '@/lib/supabase/storage'
import { HELP_STORAGE_PREFIX, WHISPER_TRANSCRIPT_PREFIX } from '@/lib/help/constants'
import { createHelpQuestion, listHelpQuestions, updateHelpQuestionEmbedding } from '@/lib/help/db'
import { classifyQuestion, embedText, transcribeVoice } from '@/lib/help/ai'
import { sendNewQuestionEmail } from '@/lib/help/email'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const q        = url.searchParams.get('q') ?? undefined
    const category = url.searchParams.get('category') ?? undefined
    const limit    = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50)
    const offset   = parseInt(url.searchParams.get('offset') ?? '0', 10)

    const questions = await listHelpQuestions({ q, category, limit, offset })
    return NextResponse.json({ ok: true, data: questions })
  } catch (err) {
    logServerError('GET /api/help/questions', err, { userId: auth.userId })
    return NextResponse.json({ ok: false, error: 'Failed to load questions.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const rateLimitRes = await checkRateLimitAsync(helpQuestionLimiter, `help_question:${auth.userId}`)
  if (rateLimitRes) return rateLimitRes

  try {
    const form = await request.formData()
    const title         = (form.get('title') as string | null)?.trim() ?? ''
    const bodyText      = (form.get('body') as string | null)?.trim() || null
    const notifyRaw     = form.get('notifyOnAnswer')
    const notifyOnAnswer = notifyRaw === null ? true : notifyRaw !== 'false'
    const voiceFile     = form.get('voice') as File | null
    const attachFile    = form.get('file') as File | null

    if (!title || title.length < 5) {
      return NextResponse.json({ ok: false, error: 'Title must be at least 5 characters.' }, { status: 400 })
    }

    // Validate uploads
    if (voiceFile) {
      const v = await validateUpload(voiceFile, 'dm-voice')
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: v.status })
    }
    if (attachFile) {
      const v = await validateUpload(attachFile, 'dm-file')
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: v.status })
    }

    // Transcribe voice → append to body
    let fullBody = bodyText
    if (voiceFile) {
      try {
        const transcript = await transcribeVoice(voiceFile)
        if (transcript) {
          fullBody = (fullBody ?? '') + WHISPER_TRANSCRIPT_PREFIX + transcript
        }
      } catch (err) {
        logServerError('Voice transcription failed — continuing without transcript', err)
      }
    }

    // Classify
    const category = await classifyQuestion(title, fullBody ?? '')

    // Create question row first (get the ID for storage paths)
    const question = await createHelpQuestion({
      userId: auth.userId,
      title,
      body: fullBody,
      category,
      voiceUrl: null,
      voiceFileName: null,
      fileUrl: null,
      fileName: null,
      notifyOnAnswer,
    })

    // Upload files to storage
    let voiceUrl: string | null = null
    let voiceFileName: string | null = null
    let fileUrl: string | null = null
    let fileName: string | null = null

    if (voiceFile) {
      const ext  = voiceFile.name.split('.').pop() ?? 'webm'
      const storagePath = `${HELP_STORAGE_PREFIX}/${question.id}/voice.${ext}`
      const fileBuffer  = Buffer.from(await voiceFile.arrayBuffer())
      await uploadToStorage({ fileBuffer, mimeType: voiceFile.type, storagePath })
      voiceUrl      = storagePath
      voiceFileName = voiceFile.name
    }

    if (attachFile) {
      const storagePath = `${HELP_STORAGE_PREFIX}/${question.id}/${attachFile.name}`
      const fileBuffer  = Buffer.from(await attachFile.arrayBuffer())
      await uploadToStorage({ fileBuffer, mimeType: attachFile.type, storagePath })
      fileUrl  = storagePath
      fileName = attachFile.name
    }

    // Update storage URLs if files were uploaded
    if (voiceUrl || fileUrl) {
      const { getDbPool } = await import('@/lib/db/server')
      const pool = getDbPool()
      await pool.query(
        `UPDATE public.help_questions
         SET voice_url=$1, voice_file_name=$2, file_url=$3, file_name=$4
         WHERE id=$5`,
        [voiceUrl, voiceFileName, fileUrl, fileName, question.id],
      )
      question.voiceUrl      = voiceUrl
      question.voiceFileName = voiceFileName
      question.fileUrl       = fileUrl
      question.fileName      = fileName
    }

    // Embed + email in background (non-blocking)
    void embedText(`${title}\n\n${fullBody ?? ''}`).then(embedding =>
      updateHelpQuestionEmbedding(question.id, embedding)
    ).catch(err => logServerError('Embedding failed', err, { questionId: question.id }))

    void sendNewQuestionEmail(question).catch(
      err => logServerError('sendNewQuestionEmail failed', err, { questionId: question.id })
    )

    return NextResponse.json({ ok: true, data: question }, { status: 201 })
  } catch (err) {
    logServerError('POST /api/help/questions', err, { userId: auth.userId })
    return NextResponse.json({ ok: false, error: 'Failed to create question.' }, { status: 500 })
  }
}
