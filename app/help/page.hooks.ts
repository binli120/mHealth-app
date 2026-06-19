'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useCallback, useEffect, useState } from 'react'
import type { HelpCategory } from '@/lib/help/constants'
import type { HelpQuestion } from '@/lib/help/types'

export function useHelpQuestions() {
  const [questions, setQuestions] = useState<HelpQuestion[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState<HelpCategory | 'all'>('all')

  const fetchQuestions = useCallback(async (q: string, cat: HelpCategory | 'all') => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q)             params.set('q', q)
      if (cat !== 'all') params.set('category', cat)
      const res  = await fetch(`/api/help/questions?${params.toString()}`)
      const data = await res.json() as { ok: boolean; data?: HelpQuestion[] }
      if (data.ok) setQuestions(data.data ?? [])
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void fetchQuestions(search, category), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search, category, fetchQuestions])

  return {
    questions,
    loading,
    search,
    setSearch,
    category,
    setCategory,
    prependQuestion: (q: HelpQuestion) => setQuestions(prev => [q, ...prev]),
  }
}
