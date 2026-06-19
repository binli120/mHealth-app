'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent }    from '@/components/ui/card'
import { PageHeader }           from '@/components/shared/PageHeader'
import { QuestionDetailHeader } from '@/components/help/QuestionDetailHeader'
import { AnswerCard }           from '@/components/help/AnswerCard'
import { AnswerForm }           from '@/components/help/AnswerForm'
import { useHelpQuestionDetail } from './page.hooks'

export default function HelpQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { question, loading, error, appendAnswer } = useHelpQuestionDetail(id)
  const [voiceSignedUrl, setVoiceSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!question?.voiceUrl) return
    async function resolveVoiceUrl() {
      try {
        const res  = await fetch(`/api/help/questions/${id}/voice-url`)
        const data = await res.json() as { url?: string }
        if (data.url) setVoiceSignedUrl(data.url)
      } catch { /* non-fatal */ }
    }
    void resolveVoiceUrl()
  }, [id, question?.voiceUrl])

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backHref="/help"
        backLabel="Help Center"
        breadcrumbs={[{ label: question?.title ?? 'Question' }]}
      />

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-40 bg-white rounded animate-pulse border border-gray-200" />
          </div>
        )}

        {!loading && (error || !question) && (
          <div className="text-center py-16">
            <p className="text-red-600 mb-3">{error ?? 'Question not found.'}</p>
            <Link href="/help" className="text-sm text-primary hover:underline">
              ← Back to Help Center
            </Link>
          </div>
        )}

        {!loading && question && (
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6 space-y-6">
              <QuestionDetailHeader question={question} voiceSignedUrl={voiceSignedUrl} />

              {question.answers.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">
                    {question.answers.length} Answer{question.answers.length !== 1 ? 's' : ''}
                  </h2>
                  {question.answers.map(a => (
                    <AnswerCard key={a.id} answer={a} />
                  ))}
                </div>
              )}

              <AnswerForm questionId={question.id} onAnswerPosted={appendAnswer} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
