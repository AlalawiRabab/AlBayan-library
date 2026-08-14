import type { BadgeTone } from './Badge'

export type StoryDifficulty = 'easy' | 'medium' | 'hard'
export type SubmissionStatus = 'not_submitted' | 'pending' | 'submitted' | 'graded'
export type PermissionLevel = 'full_access' | 'limited_access' | 'read_only' | 'grade_only'

export const difficultyStatus: Record<StoryDifficulty, { label: string; tone: BadgeTone }> = {
  easy: { label: 'سهل', tone: 'success' },
  medium: { label: 'متوسط', tone: 'warning' },
  hard: { label: 'متقدم', tone: 'danger' },
}

export const submissionStatus: Record<SubmissionStatus, { label: string; tone: BadgeTone }> = {
  not_submitted: { label: 'لم يُرسل', tone: 'neutral' },
  pending: { label: 'بانتظار التقييم', tone: 'warning' },
  submitted: { label: 'تم الإرسال', tone: 'primary' },
  graded: { label: 'تم التقييم', tone: 'success' },
}

export const permissionStatus: Record<PermissionLevel, { label: string; tone: BadgeTone }> = {
  full_access: { label: 'وصول كامل', tone: 'success' },
  limited_access: { label: 'وصول محدود', tone: 'warning' },
  read_only: { label: 'قراءة فقط', tone: 'neutral' },
  grade_only: { label: 'التقييم فقط', tone: 'secondary' },
}
