'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { HelpAnswer } from '@/lib/help/types'

interface AnswerFormProps {
  questionId: string
  onAnswerPosted: (answer: HelpAnswer) => void
}

export function AnswerForm({ questionId, onAnswerPosted }: AnswerFormProps) {
  const [body, setBody]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/help/questions/${questionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const data = await res.json() as { ok: boolean; data?: HelpAnswer; error?: string }
      if (!data.ok) throw new Error(data.error ?? 'Failed to post answer.')
      onAnswerPosted(data.data!)
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-4 border-t mt-4">
      <Textarea
        placeholder="Write an answer..."
        value={body}
        onChange={e => setBody(e.target.value)}
        maxLength={5000}
        rows={4}
        disabled={loading}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{body.length}/5000</span>
        <Button type="submit" disabled={loading || body.trim().length === 0} size="sm">
          {loading ? 'Posting…' : 'Post Answer'}
        </Button>
      </div>
    </form>
  )
}
