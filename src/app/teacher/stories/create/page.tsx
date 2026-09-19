'use client'

import React, { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { BookOpen, Save, ArrowRight, FileText } from 'lucide-react'

type ActiveClassroom = {
  classroom_id: string
  classroom_name: string
  grade: number
}

export default function CreateStory() {
  const router = useRouter()
  const { user, userRole, hydrated } = useAppStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [classroomsLoading, setClassroomsLoading] = useState(true)
  const [hasActiveClassroom, setHasActiveClassroom] = useState(false)
  const [linkedGrade, setLinkedGrade] = useState<number | null>(null)
  const [classroomLabel, setClassroomLabel] = useState('')

  const [story, setStory] = useState({
    title_arabic: '',
    content_arabic: '',
    difficulty: 'easy' as 'easy' | 'medium' | 'hard',
    grade_level: null as number | null,
  })

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'teacher') {
      router.replace('/')
    }
  }, [hydrated, router, userRole])

  useEffect(() => {
    if (!hydrated || userRole !== 'teacher') return

    const teacher = user as { access_code?: string; assigned_grade?: number } | null
    const accessCode = teacher?.access_code
    if (!accessCode) {
      setClassroomsLoading(false)
      setHasActiveClassroom(false)
      setLinkedGrade(null)
      return
    }

    let cancelled = false

    const loadClassrooms = async () => {
      setClassroomsLoading(true)
      try {
        const { data, error } = await supabase.rpc('teacher_get_active_classrooms', {
          teacher_access_code: accessCode,
        })

        if (cancelled) return

        if (error) {
          console.error('Error loading teacher classrooms:', error)
          setHasActiveClassroom(false)
          setLinkedGrade(null)
          setClassroomLabel('')
          return
        }

        const list = (data || []) as ActiveClassroom[]
        if (list.length === 0) {
          setHasActiveClassroom(false)
          setLinkedGrade(null)
          setClassroomLabel('')
          setStory((prev) => ({ ...prev, grade_level: null }))
          return
        }

        const assigned = teacher?.assigned_grade
        const preferred =
          typeof assigned === 'number'
            ? list.find((c) => c.grade === assigned) ?? list[0]
            : list[0]

        setHasActiveClassroom(true)
        setLinkedGrade(preferred.grade)
        setClassroomLabel(preferred.classroom_name || `الصف ${preferred.grade}`)
        setStory((prev) => ({ ...prev, grade_level: preferred.grade }))
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading teacher classrooms:', err)
          setHasActiveClassroom(false)
          setLinkedGrade(null)
        }
      } finally {
        if (!cancelled) setClassroomsLoading(false)
      }
    }

    void loadClassrooms()
    return () => {
      cancelled = true
    }
  }, [hydrated, userRole, user])

  const canPublish =
    hasActiveClassroom && linkedGrade != null && story.grade_level != null && !classroomsLoading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canPublish) {
      toast.error('لا يمكن النشر: لا يوجد فصل نشط مرتبط بحسابك')
      return
    }

    if (!story.title_arabic.trim()) {
      toast.error('الرجاء إدخال عنوان القصة')
      return
    }

    if (!story.content_arabic.trim()) {
      toast.error('الرجاء إدخال محتوى القصة')
      return
    }

    if (story.content_arabic.length < 100) {
      toast.error('القصة قصيرة جداً! اكتب على الأقل 100 حرف')
      return
    }

    try {
      setIsSubmitting(true)

      const teacherData = user as { access_code?: string } | null
      if (!teacherData?.access_code || story.grade_level == null) {
        toast.error('لا يمكن النشر: لا يوجد فصل نشط مرتبط بحسابك')
        return
      }

      const { error } = await supabase.rpc('teacher_create_story', {
        story_title: story.title_arabic,
        story_content: story.content_arabic,
        story_difficulty: story.difficulty,
        story_grade: story.grade_level,
        teacher_access_code: teacherData.access_code,
      })

      if (error) {
        console.error('Error creating story:', error)
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('فصل') || msg.includes('classroom') || msg.includes('غير مرتبط')) {
          toast.error('لا يمكن النشر: لا يوجد فصل نشط مرتبط بهذا الصف')
        } else {
          toast.error('فشل إنشاء القصة')
        }
        return
      }

      toast.success('تم إنشاء القصة بنجاح! ')

      setTimeout(() => {
        router.push('/teacher')
      }, 1500)
    } catch (error) {
      console.error('Error creating story:', error)
      toast.error('فشل إنشاء القصة')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (userRole !== 'teacher') {
    return null
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="page-container min-h-screen" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2 flex items-center gap-3">
                <BookOpen className="w-10 h-10 text-accent-green" />
                إنشاء قصة جديدة
              </h1>
              <p className="text-slate-600 text-lg font-semibold">
                اكتب قصة ملهمة للطلاب
              </p>
            </div>
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="md"
              icon={<ArrowRight className="w-5 h-5" />}
            >
              العودة
            </Button>
          </div>

          {!classroomsLoading && !hasActiveClassroom && (
            <Card className="mb-6 border-2 border-rose-200 bg-rose-50">
              <p className="text-rose-700 font-bold text-lg">
                لا يمكن نشر قصة حاليًا: لا يوجد فصل نشط مرتبط بحسابك. يرجى التواصل مع المسؤولة لربط فصل نشط.
              </p>
            </Card>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <Card>
                <label className="block text-ink font-bold text-xl mb-3">
                  <FileText className="w-6 h-6 inline-block ms-2" />
                  عنوان القصة
                </label>
                <input
                  type="text"
                  value={story.title_arabic}
                  onChange={(e) =>
                    setStory({ ...story, title_arabic: e.target.value })
                  }
                  placeholder="مثال: القط الشجاع"
                  className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                  disabled={isSubmitting || !canPublish}
                  required
                />
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <label className="block text-ink font-bold text-xl mb-3">
                    مستوى الصعوبة
                  </label>
                  <select
                    value={story.difficulty}
                    onChange={(e) =>
                      setStory({
                        ...story,
                        difficulty: e.target.value as 'easy' | 'medium' | 'hard',
                      })
                    }
                    className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                    disabled={isSubmitting || !canPublish}
                  >
                    <option value="easy">سهل </option>
                    <option value="medium">متوسط </option>
                    <option value="hard">صعب </option>
                  </select>
                </Card>

                <Card>
                  <label className="block text-ink font-bold text-xl mb-3">
                    الصف الدراسي
                  </label>
                  <select
                    value={story.grade_level ?? ''}
                    className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg bg-white text-ink font-semibold opacity-75 cursor-not-allowed"
                    disabled={true}
                  >
                    {story.grade_level != null ? (
                      <option value={story.grade_level}>
                        الصف {story.grade_level}
                        {classroomLabel ? ` — ${classroomLabel}` : ''}
                      </option>
                    ) : (
                      <option value="">
                        {classroomsLoading ? 'جاري التحميل...' : 'لا يوجد فصل نشط'}
                      </option>
                    )}
                  </select>
                  <p className="text-slate-500 text-sm mt-2">
                    يُزامن تلقائيًا من الفصل النشط المرتبط بحسابك
                  </p>
                </Card>
              </div>

              <Card>
                <label className="block text-ink font-bold text-xl mb-3">
                  محتوى القصة
                </label>
                <textarea
                  value={story.content_arabic}
                  onChange={(e) =>
                    setStory({ ...story, content_arabic: e.target.value })
                  }
                  placeholder="اكتب قصة رائعة هنا... (100 حرف على الأقل)"
                  rows={15}
                  className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink leading-relaxed font-semibold resize-none"
                  disabled={isSubmitting || !canPublish}
                  required
                />
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">
                    عدد الأحرف: {story.content_arabic.length}
                  </span>
                  <span
                    className={
                      story.content_arabic.length >= 100
                        ? 'text-accent-green font-bold'
                        : 'text-slate-500'
                    }
                  >
                    {story.content_arabic.length >= 100 ? ' جاهز' : 'الحد الأدنى: 100'}
                  </span>
                </div>
              </Card>

              {story.title_arabic && story.content_arabic && story.grade_level != null && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-white  ">
                    <h3 className="text-2xl font-bold text-ink mb-4">
                      معاينة القصة
                    </h3>
                    <div className="bg-white p-6 rounded-lg">
                      <h4 className="text-2xl font-bold text-ink mb-4">
                        {story.title_arabic}
                      </h4>
                      <div className="flex gap-2 mb-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${
                            story.difficulty === 'easy'
                              ? 'bg-accent-green text-ink'
                              : story.difficulty === 'medium'
                              ? 'bg-secondary text-ink'
                              : 'bg-accent-red text-ink'
                          }`}
                        >
                          {story.difficulty === 'easy'
                            ? 'سهل'
                            : story.difficulty === 'medium'
                            ? 'متوسط'
                            : 'صعب'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary text-ink">
                          الصف {story.grade_level}
                        </span>
                      </div>
                      <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-wrap font-semibold">
                        {story.content_arabic}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              )}

              <div className="flex gap-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || !canPublish}
                  icon={<Save className="w-5 h-5" />}
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'نشر القصة'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
