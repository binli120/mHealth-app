import { QuestionCard } from './QuestionCard'
import type { HelpQuestion } from '@/lib/help/types'

interface QuestionFeedProps {
  questions: HelpQuestion[]
  loading?: boolean
}

export function QuestionFeed({ questions, loading }: QuestionFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No questions yet. Be the first to ask!
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {questions.map(q => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </div>
  )
}
