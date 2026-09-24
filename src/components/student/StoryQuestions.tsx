'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '@/components/Button'
import Card from '@/components/Card'
import LoadingState from '@/components/LoadingState'
import { useAppStore } from '@/lib/store'
import { formsService } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { ArrowRight, Send, BookOpen, AlertCircle, Mic } from 'lucide-react'

interface Question {
  id: string
  type: 'short_answer' | 'long_answer' | 'multiple_choice'
  required: boolean
  text_arabic: string
  options?: string[]
}

interface FormTemplate {
  id: string
  story_id: string
  title_arabic: string
  description_arabic: string
  questions: Question[]
  is_active: boolean
}

type Props = {
  storyId: string
  onSubmitted?: () => void
  showBack?: boolean
  // Optional recording controls from the reader page
  onStartRecording?: () => void
  onStopRecording?: () => void
  isRecordingExternal?: boolean
  hasAudioExternal?: boolean
  isPlayingExternal?: boolean
  onTogglePlay?: () => void
  onResetRecording?: () => void
  onSubmitRecording?: () => Promise<void> | void
}

export default function StoryQuestions(props: Props) {
  const { storyId, onSubmitted, showBack = false, onStartRecording, onStopRecording, isRecordingExternal, hasAudioExternal, isPlayingExternal, onTogglePlay, onResetRecording, onSubmitRecording } = props
  const { user, isAuthenticated } = useAppStore()

  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [hasSavedAudio, setHasSavedAudio] = useState(false)
  const [firstUnansweredId, setFirstUnansweredId] = useState<string | null>(null)
  const questionRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!isAuthenticated || !user) return
    loadFormTemplate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, storyId])

  // Poll for presence of audio recording saved by reader
  useEffect(() => {
    const storageKey = `audio_recording_${storyId}`
    const check = () => {
      try {
        const url = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
        setHasSavedAudio(!!url)
        setHasAudio(!!url || !!hasAudioExternal)
      } catch {}
    }
    check()
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [storyId, hasAudioExternal])

  // Track first unanswered required question
  useEffect(() => {
    if (!formTemplate) return
    for (const q of formTemplate.questions) {
      if (q.required && (!answers[q.id] || answers[q.id].trim() === '')) {
        setFirstUnansweredId(q.id)
        return
      }
    }
    setFirstUnansweredId(null)
  }, [formTemplate, answers])

  const loadFormTemplate = async () => {
    try {
      setIsLoading(true)
      const studentData = user as any
      const studentAccessCode = studentData.access_code
      const formData = await formsService.getStudentFormTemplate(studentAccessCode, storyId)

      if (!formData) {
        toast.error('لا يوجد نموذج أسئلة لهذه القصة')
        setFormTemplate(null)
        return
      }

      setFormTemplate(formData)
      const initialAnswers: Record<string, string> = {}
      formData.questions.forEach((q: Question) => { initialAnswers[q.id] = '' })
      setAnswers(initialAnswers)
    } catch (error) {
      console.error('Failed to load form template:', error)
      toast.error('حدث خطأ في تحميل نموذج الأسئلة')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const validateForm = () => {
    if (!formTemplate) return false
    for (const q of formTemplate.questions) {
      if (q.required && (!answers[q.id] || answers[q.id].trim() === '')) {
        toast.error(`يرجى الإجابة على السؤال: ${q.text_arabic}`)
        return false
      }
    }
    return true
  }

  const scrollToRecording = () => {
    const el = document.getElementById('student-recording-section')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToFirstUnanswered = () => {
    if (!firstUnansweredId) return
    const node = questionRefs.current[firstUnansweredId]
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const input = node.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
      if (input) {
        setTimeout(() => input.focus(), 350)
      }
    }
  }

  const handlePrimaryAction = async () => {
    if (!hasAudio) {
      toast.error(' يجب تسجيل الصوت أولاً')
      scrollToRecording()
      return
    }
    // If there is a freshly recorded audio (from page) but not yet saved to cloud/localStorage, submit recording first
    if (!hasSavedAudio && hasAudioExternal && onSubmitRecording) {
      await onSubmitRecording()
      return
    }
    if (firstUnansweredId) {
      toast.error(' أجب على نموذج الأسئلة')
      scrollToFirstUnanswered()
      return
    }
    handleSubmit()
  }

  const handleSubmit = async () => {
    if (!formTemplate || !user) return
    if (!validateForm()) return

    // Require audio recording before submission
    const storageKey = `audio_recording_${storyId}`
    const audioUrlCheck = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
    if (!audioUrlCheck) {
      toast.error('يجب حفظ تسجيل الصوت قبل إرسال الإجابات ')
      return
    }

    try {
      setIsSubmitting(true)
      toast.loading('جاري التقييم التلقائي للإجابات...', { id: 'auto-grading' })

      const studentData = user as any
      const storageKey = `audio_recording_${storyId}`
      const audioUrl = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null

      const studentAccessCode = studentData.access_code
      const submissionKeyStorage = `submission_attempt_${storyId}_${formTemplate.id}`
      let idempotencyKey = localStorage.getItem(submissionKeyStorage)
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID()
        localStorage.setItem(submissionKeyStorage, idempotencyKey)
      }
      toast.loading('جاري تقييم الإجابات بالذكاء الاصطناعي...', { id: 'auto-grading' })
      const submissionResponse = await fetch('/api/student/submit-and-auto-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentAccessCode,
          storyId,
          formTemplateId: formTemplate.id,
          idempotencyKey,
          answers,
          audioUrl: audioUrl || undefined
        })
      })
      const submissionResult = await submissionResponse.json()

      if (!submissionResponse.ok) {
        throw new Error(submissionResult.error || 'تعذر إرسال الإجابات')
      }

      if (submissionResult.autoGraded) {
        toast.success(`تم التقييم التلقائي! الدرجة: ${submissionResult.grade}`, { id: 'auto-grading' })
      } else {
        toast.error(
          submissionResult.message || 'تم حفظ التسليم بنجاح، ويحتاج مراجعة المعلمة لأن التقييم الآلي غير متاح حالياً.',
          { id: 'auto-grading' }
        )
      }

      if (audioUrl) {
        localStorage.removeItem(storageKey)
      }
      localStorage.removeItem(submissionKeyStorage)

      toast.success('أحسنتِ ايتها القارئة المبدعة!  لقد أتممتِ المهمة بنجاح، ونحن فخورون بكِ')
      if (onSubmitted) {
        onSubmitted()
      } else {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.assign('/student')
          }
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to submit form:', error)
      toast.error('حدث خطأ في إرسال الإجابات')
    } finally {
      setIsSubmitting(false)
      toast.dismiss('auto-grading')
    }
  }

  if (isLoading) {
    return <LoadingState label="جاري تحميل الأسئلة..." />
  }

  if (!formTemplate) {
    return (
      <Card elevation="sm" padding="lg" className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertCircle className="h-7 w-7" aria-hidden="true" /></div>
        <p className="text-lg md:text-xl font-bold text-ink">لا يوجد نموذج أسئلة لهذه القصة</p>
        {showBack && (
          <Button onClick={() => window.history.back()} className="mt-4">
            العودة
          </Button>
        )}
      </Card>
    )
  }

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold text-ink flex items-center gap-2">
            <BookOpen className="w-7 h-7 md:w-8 md:h-8 text-accent-green" />
            <span>{formTemplate.title_arabic}</span>
          </h2>
          <p className="text-slate-700 text-sm md:text-base mt-2">{formTemplate.description_arabic}</p>
        </div>
        {showBack && (
          <Button
            onClick={() => window.history.back()}
            variant="ghost"
            size="sm"
            icon={<ArrowRight className="w-4 h-4" />}
            className="self-end md:self-auto"
          >
            العودة
          </Button>
        )}
      </div>

      {/* Form (hidden until audio exists) */}
      {hasAudio ? (
        <>
          <div className="space-y-4 md:space-y-6">
            {formTemplate.questions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                ref={(el: HTMLDivElement | null) => { questionRefs.current[question.id] = el }}
              >
                <Card elevation="sm" padding="md" className="p-4 md:p-6">
                  <div className="mb-4">
                    <h3 className="text-lg md:text-xl font-bold text-ink mb-2">
                      السؤال {index + 1}
                      {question.required && <span className="text-accent-red me-2">*</span>}
                    </h3>
                    <p className="text-base md:text-lg text-slate-700 mb-4">{question.text_arabic}</p>
                  </div>

                  {question.type === 'short_answer' && (
                    <input
                      type="text"
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="اكتب إجابتك هنا..."
                      className="w-full px-3 md:px-4 py-2 md:py-3 text-base md:text-lg border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-gray-800"
                      disabled={isSubmitting}
                    />
                  )}

                  {question.type === 'long_answer' && (
                    <textarea
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="اكتب إجابتك المفصلة هنا..."
                      rows={4}
                      className="w-full px-3 md:px-4 py-2 md:py-3 text-base md:text-lg border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-gray-800 resize-none"
                      disabled={isSubmitting}
                    />
                  )}

                  {question.type === 'multiple_choice' && question.options && (
                    <div className="space-y-2 md:space-y-3">
                      {question.options.map((option, optionIndex) => (
                        <label key={optionIndex} className="flex items-center gap-2 md:gap-3 cursor-pointer py-2 md:py-0">
                          <input
                            type="radio"
                            name={question.id}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-6 h-6 md:w-5 md:h-5 text-primary"
                            disabled={isSubmitting}
                          />
                          <span className="text-base md:text-lg text-slate-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Progress Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-6"
          >
            <Card elevation="sm" padding="md">
              <div className="text-center">
                <p className="text-slate-700 mb-2">تقدم الإجابة</p>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <motion.div
                    className="bg-white   h-3 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(Object.values(answers).filter(a => a.trim() !== '').length / formTemplate.questions.length) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-sm text-slate-700 mt-2">
                  {Object.values(answers).filter(a => a.trim() !== '').length} من {formTemplate.questions.length} أسئلة
                </p>
              </div>
            </Card>
          </motion.div>
        </>
      ) : (
        <Card elevation="sm" padding="lg" className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Mic className="h-7 w-7" aria-hidden="true" /></div>
          <p className="text-ink font-bold">سجّل صوتك أولاً لإظهار نموذج الأسئلة</p>
          <p className="text-slate-700 text-sm mt-2">استخدم الزر في الأسفل لبدء التسجيل</p>
        </Card>
      )}

      {/* Floating Submit Bar */}
      <div className="fixed inset-x-0 bottom-4 px-4 z-40">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xl md:p-4">
            {/* Contextual message area */}
            {!hasAudio && (
              <div className="text-gray-800 text-sm md:text-base mb-2">
                 تسجيل القراءة مطلوب قبل إرسال الإجابات
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {/* Recording CTA when no audio and handlers provided */}
              {!hasAudio && onStartRecording && (
                <Button
                  onClick={isRecordingExternal ? onStopRecording : onStartRecording}
                  variant={isRecordingExternal ? 'danger' : 'secondary'}
                  size="md"
                  className="whitespace-nowrap"
                >
                  {isRecordingExternal ? ' إيقاف التسجيل' : ' بدء التسجيل'}
                </Button>
              )}
              {/* Play/Pause control when audio exists */}
              {hasAudio && onTogglePlay && (
                <Button
                  onClick={onTogglePlay}
                  variant={isPlayingExternal ? 'secondary' : 'primary'}
                  size="md"
                  className="whitespace-nowrap min-w-[120px]"
                >
                  {isPlayingExternal ? ' إيقاف' : ' تشغيل'}
                </Button>
              )}
              {/* Record again: delete old and start new */}
              {hasAudio && onResetRecording && (
                <Button
                  onClick={onResetRecording}
                  variant="ghost"
                  size="md"
                  className="whitespace-nowrap min-w-[140px] border-2 border-gray-300"
                >
                   إعادة التسجيل
                </Button>
              )}
              <Button
                onClick={handlePrimaryAction}
                variant={!hasAudio || (!hasSavedAudio && hasAudioExternal) || firstUnansweredId ? 'secondary' : 'primary'}
                size="md"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                icon={<Send className="w-4 h-4 md:w-5 md:h-5" />}
                className="flex-1 min-w-[200px] text-base md:text-lg"
              >
                {isSubmitting
                  ? 'جاري الإرسال...'
                  : !hasAudio
                    ? ' سجّل صوتك أولاً'
                    : (!hasSavedAudio && hasAudioExternal)
                      ? 'إرسال التسجيل'
                      : firstUnansweredId
                        ? ' أجب على نموذج الأسئلة'
                        : 'إرسال الإجابات'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      
    </div>
  )
}


