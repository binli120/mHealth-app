/**
 * TypeScript interfaces for the Application Status Detail page.
 * @author Bin Lee
 */

import type { ApplicationStatus } from "@/lib/application-status"

export interface PageProps {
  params: Promise<{ id: string }>
}

export interface ApplicationDraftRecord {
  id: string
  status: ApplicationStatus
  applicationType: string | null
  draftState: Record<string, unknown> | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DraftApiResponse {
  ok: boolean
  record?: ApplicationDraftRecord
  error?: string
}

export interface TimelineEvent {
  id: string
  title: string
  description: string
  date: string
  state: "completed" | "current" | "pending"
}
