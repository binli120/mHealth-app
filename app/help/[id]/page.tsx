'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent }    from '@/components/ui/card'
import { QuestionDetailHeader } from '@/components/help/QuestionDetailHeader'
import { AnswerCard }           from '@/components/help/AnswerCard'
import { AnswerForm }           from '@/components/help/AnswerForm'
import { ShieldHeartIcon }      from '@/lib/icons'
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link
            href="/help"
            className="flex flex-1 items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">HealthCompass MA</span>
          </div>
          <div className="flex-1" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            <div className="h-40 bg-muted rounded animate-pulse" />
          </div>
        )}

        {!loading && (error || !question) && (
          <div>
            <p className="text-destructive">{error ?? 'Question not found.'}</p>
            <Link href="/help" className="text-sm text-primary hover:underline mt-2 block">
              ← Back to Help
            </Link>
          </div>
        )}

        {!loading && question && (
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
        )}
      </main>
    </div>
  )
}
