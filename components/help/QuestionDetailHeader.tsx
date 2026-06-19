import { FileText, Mic } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { HELP_CATEGORY_LABELS } from '@/lib/help/constants'
import type { HelpQuestion } from '@/lib/help/types'
import { formatDistanceToNow } from 'date-fns'

interface QuestionDetailHeaderProps {
  question: HelpQuestion
  voiceSignedUrl?: string | null
  fileSignedUrl?: string | null
}

export function QuestionDetailHeader({ question, voiceSignedUrl, fileSignedUrl }: QuestionDetailHeaderProps) {
  const [bodyMain, voiceTranscript] = splitTranscript(question.body)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="secondary">{HELP_CATEGORY_LABELS[question.category]}</Badge>
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(question.createdAt), { addSuffix: true })}
        </span>
      </div>

      <h1 className="text-2xl font-semibold leading-tight">{question.title}</h1>

      {bodyMain && (
        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{bodyMain}</p>
      )}

      {voiceSignedUrl && (
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
          <audio controls src={voiceSignedUrl} className="h-8 flex-1" />
        </div>
      )}

      {voiceTranscript && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Voice transcript</summary>
          <p className="mt-1 pl-3 border-l whitespace-pre-wrap">{voiceTranscript}</p>
        </details>
      )}

      {question.fileName && (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Attachment:</span>
          {fileSignedUrl ? (
            <a
              href={fileSignedUrl}
              download={question.fileName}
              className="font-medium text-primary hover:underline truncate"
            >
              {question.fileName}
            </a>
          ) : (
            <span className="font-medium text-muted-foreground truncate">{question.fileName}</span>
          )}
        </div>
      )}
    </div>
  )
}

function splitTranscript(body: string | null): [string | null, string | null] {
  if (!body) return [null, null]
  const marker = '\n\n[Voice transcript]: '
  const idx = body.indexOf(marker)
  if (idx === -1) return [body || null, null]
  return [body.slice(0, idx) || null, body.slice(idx + marker.length) || null]
}
