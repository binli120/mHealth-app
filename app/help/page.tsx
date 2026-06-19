'use client'

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useState } from 'react'
import { HelpCircle, Search } from 'lucide-react'
import { Button }            from '@/components/ui/button'
import { Input }             from '@/components/ui/input'
import { PageHeader }        from '@/components/shared/PageHeader'
import { PageIntro }         from '@/components/shared/PageIntro'
import { CategoryPills }     from '@/components/help/CategoryPills'
import { QuestionFeed }      from '@/components/help/QuestionFeed'
import { AskQuestionDialog } from '@/components/help/AskQuestionDialog'
import { getMessage }        from '@/lib/i18n/messages'
import { useAppSelector }    from '@/lib/redux/hooks'
import { useHelpQuestions }  from './page.hooks'

export default function HelpPage() {
  const language = useAppSelector((state) => state.app.language)
  const { questions, loading, search, setSearch, category, setCategory, prependQuestion } =
    useHelpQuestions()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backHref="/customer/dashboard"
        backLabel={getMessage(language, 'helpDashboardLink')}
        breadcrumbs={[{ label: getMessage(language, 'helpNavBreadcrumb') }]}
      />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageIntro
          icon={<HelpCircle className="h-6 w-6 text-primary" />}
          iconBg="bg-primary/10"
          title={getMessage(language, 'helpPageTitle')}
          description={getMessage(language, 'helpPageDesc')}
        />

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder={getMessage(language, 'helpSearchPlaceholder')}
              className="pl-9 bg-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            {getMessage(language, 'helpAskButton')}
          </Button>
        </div>

        <CategoryPills selected={category} onChange={setCategory} />

        <div className="mt-4">
          <QuestionFeed questions={questions} loading={loading} />
        </div>
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
