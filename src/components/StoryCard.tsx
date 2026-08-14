import React from 'react'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, Clock3, FileCheck2, LockKeyhole } from 'lucide-react'
import Card from './Card'
import Button from './Button'
import Badge, { BadgeTone } from './Badge'
import { getDifficultyArabic } from '@/lib/utils'

interface StoryCardProps {
  story: any
  onRead: () => void
  status?: 'not_started' | 'in_progress' | 'completed'
  isLocked?: boolean
  isNext?: boolean
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  onRead,
  status = 'not_started',
  isLocked = false,
  isNext = false,
}) => {
  const difficulty = story.story_difficulty || story.difficulty
  const diffLabel = getDifficultyArabic(difficulty)
  const difficultyTone: BadgeTone = difficulty === 'hard' ? 'danger' : difficulty === 'medium' ? 'warning' : 'success'

  const statusIcon = () => {
    if (story.submission_status === 'pending') return <Clock3 className="h-7 w-7" />
    if (story.submission_status === 'graded') return <CheckCircle2 className="h-7 w-7" />
    if (story.submission_status === 'reviewed') return <FileCheck2 className="h-7 w-7" />
    if (status === 'completed') return <CheckCircle2 className="h-7 w-7" />
    if (status === 'in_progress') return <Clock3 className="h-7 w-7" />
    if (isLocked) return <LockKeyhole className="h-7 w-7" />
    return <BookOpen className="h-7 w-7" />
  }

  const buttonLabel = story.submission_status === 'pending'
    ? 'تم الإرسال'
    : story.submission_status === 'graded'
      ? 'تم التقييم'
      : story.submission_status === 'reviewed'
        ? 'تمت المراجعة'
        : status === 'completed'
          ? 'إعادة القراءة'
          : 'اقرأ القصة'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Card
        className={`relative flex h-full flex-col overflow-hidden ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
        elevation="md"
        variant={isLocked ? 'default' : 'interactive'}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-primary-100" />
        <div className="mb-4 mt-1 flex items-start justify-between gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 shadow-sm">
            {statusIcon()}
          </div>
          {isNext && <Badge tone="warning">اقرأ الآن</Badge>}
        </div>

        <h3 className="mb-2 line-clamp-2 text-start text-lg font-black text-ink">
          {story.story_title || story.title_arabic}
        </h3>

        <div className="mb-4 flex items-center justify-between gap-3 text-sm">
          <Badge tone={difficultyTone}>{diffLabel}</Badge>
          <span className="text-slate-500">الصف {story.story_grade_level || story.grade_level}</span>
        </div>

        <p className="mb-5 line-clamp-3 flex-1 text-start text-sm leading-7 text-slate-600">
          {(story.story_content || story.content_arabic || 'لا يوجد محتوى').substring(0, 80)}...
        </p>

        <Button
          onClick={onRead}
          disabled={isLocked || story.submission_status !== 'not_submitted'}
          size="md"
          className="w-full"
          variant={isNext ? 'secondary' : 'primary'}
        >
          {buttonLabel}
        </Button>
      </Card>
    </motion.div>
  )
}

export default StoryCard
