/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.app.language)

  const handleChange = (value: string) => {
    if (isSupportedLanguage(value)) dispatch(setLanguage(value))
  }

  return (
    <Select value={language} onValueChange={handleChange}>
      <SelectTrigger className={className ?? "w-[140px] border-border bg-card text-foreground"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
