import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HELP_CATEGORY_LABELS } from '@/lib/help/constants'
import type { HelpQuestion } from '@/lib/help/types'
import { formatDistanceToNow } from 'date-fns'

interface QuestionCardProps {
  question: HelpQuestion
}

export function QuestionCard({ question }: QuestionCardProps) {
  return (
    <Link href={`/help/${question.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-snug line-clamp-2">{question.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="text-xs">
                  {HELP_CATEGORY_LABELS[question.category]}
                </Badge>
                <span>{formatDistanceToNow(new Date(question.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground shrink-0 text-sm">
              <MessageCircle className="h-4 w-4" />
              <span>{question.answerCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
