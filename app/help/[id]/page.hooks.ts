'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useCallback, useEffect, useState } from 'react'
import type { HelpAnswer, HelpQuestionDetail } from '@/lib/help/types'

export function useHelpQuestionDetail(id: string) {
  const [question, setQuestion] = useState<HelpQuestionDetail | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res  = await fetch(`/api/help/questions/${id}`)
        const data = await res.json() as { ok: boolean; data?: HelpQuestionDetail; error?: string }
        if (!data.ok) throw new Error(data.error ?? 'Not found')
        setQuestion(data.data ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  const appendAnswer = useCallback((answer: HelpAnswer) => {
    setQuestion(prev =>
      prev
        ? { ...prev, answers: [...prev.answers, answer], answerCount: prev.answerCount + 1 }
        : prev,
    )
  }, [])

  return { question, loading, error, appendAnswer }
}
