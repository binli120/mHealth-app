'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, HelpCircle, Search } from 'lucide-react'
import { Button }            from '@/components/ui/button'
import { Input }             from '@/components/ui/input'
import { CategoryPills }     from '@/components/help/CategoryPills'
import { QuestionFeed }      from '@/components/help/QuestionFeed'
import { AskQuestionDialog } from '@/components/help/AskQuestionDialog'
import { ShieldHeartIcon }   from '@/lib/icons'
import { useHelpQuestions }  from './page.hooks'

export default function HelpPage() {
  const { questions, loading, search, setSearch, category, setCategory, prependQuestion } =
    useHelpQuestions()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link
            href="/customer/dashboard"
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
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <HelpCircle className="h-3.5 w-3.5" />
            Community Q&amp;A
          </div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Help Center</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Ask questions and get answers from healthcare professionals and other community members.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
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
      </main>

      <AskQuestionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onQuestionCreated={q => {
          prependQuestion(q)
          setDialogOpen(false)
        }}
      />
    </div>
  )
}
