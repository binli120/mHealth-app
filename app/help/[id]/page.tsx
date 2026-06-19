'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button }               from '@/components/ui/button'
import { Card, CardContent }    from '@/components/ui/card'
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
        const res  = await fetch(
          `/api/help/questions/${id}/voice-url?path=${encodeURIComponent(question!.voiceUrl!)}`,
        )
        const data = await res.json() as { url?: string }
        if (data.url) setVoiceSignedUrl(data.url)
      } catch { /* non-fatal — audio just won't render */ }
    }
    void resolveVoiceUrl()
  }, [id, question?.voiceUrl])

  if (loading) {
    return (
      <main className="container max-w-2xl py-8 space-y-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
      </main>
    )
  }

  if (error || !question) {
    return (
      <main className="container max-w-2xl py-8">
        <p className="text-destructive">{error ?? 'Question not found.'}</p>
        <Link href="/help" className="text-sm text-primary hover:underline mt-2 block">
          ← Back to Help
        </Link>
      </main>
    )
  }

  return (
    <main className="container max-w-2xl py-8 space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/help">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Help
        </Link>
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <QuestionDetailHeader question={question} voiceSignedUrl={voiceSignedUrl} />

          {question.answers.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
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
    </main>
  )
}
