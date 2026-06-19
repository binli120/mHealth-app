/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { HelpCategory } from './constants'

export type BadgeType = 'admin' | 'professional' | null

export interface HelpQuestion {
  id: string
  userId: string
  title: string
  body: string | null
  category: HelpCategory
  voiceUrl: string | null
  voiceFileName: string | null
  fileUrl: string | null
  fileName: string | null
  notifyOnAnswer: boolean
  answerCount: number
  createdAt: string
}

export interface HelpAnswer {
  id: string
  questionId: string
  userId: string
  body: string
  badgeType: BadgeType
  displayName: string
  createdAt: string
}

export interface HelpQuestionDetail extends HelpQuestion {
  answers: HelpAnswer[]
}

export interface SimilarQuestion {
  id: string
  title: string
  category: HelpCategory
  answerCount: number
}
