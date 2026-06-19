import { ShieldCheck, UserCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { HelpAnswer } from '@/lib/help/types'
import type { SupportedLanguage } from '@/lib/i18n/languages'
import { getMessage } from '@/lib/i18n/messages'
import { formatDistanceToNow } from 'date-fns'

interface AnswerCardProps {
  answer: HelpAnswer
  language: SupportedLanguage
}

export function AnswerCard({ answer, language }: AnswerCardProps) {
  const badgeConfig = answer.badgeType === 'admin'
    ? { label: getMessage(language, 'helpBadgeAdmin'),        className: 'bg-blue-100 text-blue-800 border-blue-200' }
    : answer.badgeType === 'professional'
    ? { label: getMessage(language, 'helpBadgeProfessional'), className: 'bg-green-100 text-green-800 border-green-200' }
    : null

  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {badgeConfig ? (
          <Badge variant="outline" className={badgeConfig.className}>
            <ShieldCheck className="mr-1 h-3 w-3" />
            {badgeConfig.label}
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
