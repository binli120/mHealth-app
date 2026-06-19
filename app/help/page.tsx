'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button }              from '@/components/ui/button'
import { Input }               from '@/components/ui/input'
import { CategoryPills }       from '@/components/help/CategoryPills'
import { QuestionFeed }        from '@/components/help/QuestionFeed'
import { AskQuestionDialog }   from '@/components/help/AskQuestionDialog'
import { useHelpQuestions }    from './page.hooks'

export default function HelpPage() {
  const { questions, loading, search, setSearch, category, setCategory, prependQuestion } =
    useHelpQuestions()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <main className="container max-w-2xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search questions…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>Ask a Question</Button>
      </div>

      <CategoryPills selected={category} onChange={setCategory} />

      <QuestionFeed questions={questions} loading={loading} />

      <AskQuestionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onQuestionCreated={q => {
          prependQuestion(q)
          setDialogOpen(false)
        }}
      />
    </main>
  )
}
