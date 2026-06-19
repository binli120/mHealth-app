'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch }   from '@/components/ui/switch'
import { VoiceRecorder }       from './VoiceRecorder'
import { HELP_CATEGORY_LABELS } from '@/lib/help/constants'
import type { HelpCategory }    from '@/lib/help/constants'
import type { HelpQuestion, SimilarQuestion } from '@/lib/help/types'
import { getMessage }    from '@/lib/i18n/messages'
import { useAppSelector } from '@/lib/redux/hooks'

interface AskQuestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onQuestionCreated: (question: HelpQuestion) => void
}

export function AskQuestionDialog({ open, onOpenChange, onQuestionCreated }: AskQuestionDialogProps) {
  const language = useAppSelector((state) => state.app.language)
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [voiceFile, setVoiceFile]   = useState<File | null>(null)
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [notify, setNotify]         = useState(true)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [similar, setSimilar]       = useState<SimilarQuestion[]>([])
  const similarTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (similarTimerRef.current) clearTimeout(similarTimerRef.current)
    if (title.trim().length < 5) { setSimilar([]); return }
    similarTimerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/help/questions/similar?q=${encodeURIComponent(title)}`)
        const data = await res.json() as { ok: boolean; data?: SimilarQuestion[] }
        if (data.ok) setSimilar(data.data ?? [])
      } catch { /* non-fatal */ }
    }, 400)
    return () => { if (similarTimerRef.current) clearTimeout(similarTimerRef.current) }
  }, [title])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAttachFile(file)
    e.target.value = ''
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append('title', title.trim())
      if (body.trim()) form.append('body', body.trim())
      form.append('notifyOnAnswer', String(notify))
      if (voiceFile)  form.append('voice', voiceFile)
      if (attachFile) form.append('file', attachFile)

      const res  = await fetch('/api/help/questions', { method: 'POST', body: form })
      const data = await res.json() as { ok: boolean; data?: HelpQuestion; error?: string }
      if (!data.ok) throw new Error(data.error ?? 'Failed to submit question.')

      onQuestionCreated(data.data!)
      onOpenChange(false)
      setTitle(''); setBody(''); setVoiceFile(null); setAttachFile(null); setNotify(true); setSimilar([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [title, body, notify, voiceFile, attachFile, onQuestionCreated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getMessage(language, 'helpDialogTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="help-title">Question *</Label>
            <Input
              id="help-title"
              placeholder={getMessage(language, 'helpDialogTitlePlaceholder')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={300}
              required
              minLength={5}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="help-body">Details (optional)</Label>
            <Textarea
              id="help-body"
              placeholder={getMessage(language, 'helpDialogBodyPlaceholder')}
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={5000}
              rows={3}
            />
          </div>

          {similar.length > 0 && (
            <div className="rounded-md border bg-blue-50 dark:bg-blue-950/30 p-3 space-y-1">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                {getMessage(language, 'helpSimilarTitle')}
              </p>
              {similar.map(q => (
                <a
                  key={q.id}
                  href={`/help/${q.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-700 dark:text-blue-300 hover:underline"
                >
                  {q.title}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({HELP_CATEGORY_LABELS[q.category as HelpCategory]} · {q.answerCount} {getMessage(language, 'helpAnswerCount')})
                  </span>
                </a>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <Label>{getMessage(language, 'helpDialogVoiceLabel')}</Label>
            <VoiceRecorder onRecorded={setVoiceFile} />
          </div>

          <div className="space-y-1">
            <Label>{getMessage(language, 'helpDialogFileLabel')}</Label>
            {attachFile ? (
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="truncate flex-1">{attachFile.name}</span>
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => setAttachFile(null)}
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="mr-2 h-4 w-4" /> Attach file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="help-notify" className="cursor-pointer">
              {getMessage(language, 'helpDialogNotifyLabel')}
            </Label>
            <Switch id="help-notify" checked={notify} onCheckedChange={setNotify} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || title.trim().length < 5}>
              {loading ? getMessage(language, 'helpDialogSubmitting') : getMessage(language, 'helpDialogSubmit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
