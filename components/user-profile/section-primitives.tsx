"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

interface EditableSectionCardProps {
  title: string
  description: ReactNode
  isEditing: boolean
  children: ReactNode
  onEdit?: () => void
  editLabel?: string
  showEditAction?: boolean
}

export function EditableSectionCard({
  title,
  description,
  isEditing,
  children,
  onEdit,
  editLabel = "Edit",
  showEditAction = !isEditing && Boolean(onEdit),
}: EditableSectionCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {showEditAction && onEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
            {editLabel}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  )
}

interface SectionActionsProps {
  onCancel: () => void
  onSave: () => void
  isSaving?: boolean
  cancelLabel?: string
  saveLabel?: string
  savingLabel?: string
  showCancel?: boolean
}

export function SectionActions({
  onCancel,
  onSave,
  isSaving = false,
  cancelLabel = "Cancel",
  saveLabel = "Save changes",
  savingLabel = "Saving…",
  showCancel = true,
}: SectionActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      {showCancel ? (
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? savingLabel : saveLabel}
      </Button>
    </div>
  )
}

interface PreferenceToggleRowProps {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  ariaLabel?: string
  disabled?: boolean
}

export function PreferenceToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  ariaLabel,
  disabled = false,
}: PreferenceToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel ?? title}
        disabled={disabled}
      />
    </div>
  )
}
