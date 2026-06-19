import { ShieldCheck, UserCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { HelpAnswer } from '@/lib/help/types'
import { formatDistanceToNow } from 'date-fns'

const BADGE_CONFIG = {
  admin:        { label: 'Admin',                  className: 'bg-blue-100 text-blue-800 border-blue-200' },
  professional: { label: 'Healthcare Professional', className: 'bg-green-100 text-green-800 border-green-200' },
} as const

interface AnswerCardProps {
  answer: HelpAnswer
}

export function AnswerCard({ answer }: AnswerCardProps) {
  const badge = answer.badgeType ? BADGE_CONFIG[answer.badgeType] : null

  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {badge ? (
          <Badge variant="outline" className={badge.className}>
            <ShieldCheck className="mr-1 h-3 w-3" />
            {badge.label}
          </Badge>
        ) : (
          <UserCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium text-sm">{answer.displayName}</span>
        <span className="text-muted-foreground text-sm">
          {formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer.body}</p>
    </div>
  )
}
