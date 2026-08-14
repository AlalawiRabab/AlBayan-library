'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import StoryCard from '@/components/StoryCard'
import StatCard from '@/components/StatCard'
import EmptyState from '@/components/EmptyState'
import { useAppStore } from '@/lib/store'
import { storiesService, studentsService, supabase } from '@/lib/supabase'
import { StudentClassroom } from '@/types'
import toast, { Toaster } from 'react-hot-toast'
import { showPageLoader } from '@/components/PageTransitionLoader'
import { Award, BookOpen, FileCheck2, LibraryBig, Loader2, Sparkles, Target } from 'lucide-react'

export default function StudentDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, hydrated, selectedClassroomId, setSelectedClassroomId } = useAppStore()
  const [classrooms, setClassrooms] = useState<StudentClassroom[]>([])
  const [stories, setStories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ storiesRead: 0, formsSubmitted: 0, titleName: 'قارئ مبتدئ' })

  const loadClassrooms = async () => {
    const studentData = user as any
    if (!studentData?.access_code) return
    try {
      const list = await studentsService.getClassrooms(studentData.access_code)
      setClassrooms(list || [])
      if (list?.length > 0 && selectedClassroomId == null) {
        setSelectedClassroomId(list[0].classroom_id)
      }
    } catch (e) {
      console.warn('Failed to load classrooms:', e)
      setClassrooms([])
    }
  }

  const loadStories = async () => {
    try {
      setIsLoading(true)
      const studentData = user as any
      if (!studentData || !studentData.access_code) {
        toast.error('بيانات الطالب غير متوفرة')
        return
      }
      const studentAccessCode = studentData.access_code
      const fetchedStories = await storiesService.getStudentStoryStatus(
        studentAccessCode,
        selectedClassroomId ?? undefined
      )
      setStories(fetchedStories || [])

      // Load stats and achievement title from students table (same source as profile)
      let storiesReadCount = 0
      let formsSubmittedCount = 0
      let titleName = 'قارئ مبتدئ'

      try {
        const { data: studentRow, error: studentError } = await supabase
          .from('students')
          .select(`
            stories_read,
            forms_submitted,
            achievement_titles!students_current_title_id_fkey ( name_arabic )
          `)
          .eq('id', studentData.id)
          .single()

        if (!studentError && studentRow) {
          storiesReadCount = (studentRow as any).stories_read ?? 0
          formsSubmittedCount = (studentRow as any).forms_submitted ?? 0
          const title = (studentRow as any).achievement_titles
          if (title?.name_arabic) titleName = title.name_arabic
        }
      } catch (e) {
        console.warn('Error loading student stats for dashboard:', e)
      }

      setStats(prev => ({
        ...prev,
        storiesRead: storiesReadCount,
        formsSubmitted: formsSubmittedCount,
        titleName
      }))
      
    } catch (error) {
      console.error('Failed to load stories:', error)
      console.error('Error details:', error)
      toast.error('حدث خطأ في تحميل القصص')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) {
      if (!hydrated) return
      if (!isAuthenticated || !user) router.push('/')
      return
    }
    loadClassrooms()
  }, [hydrated, user, isAuthenticated, router])

  useEffect(() => {
    if (!user || !isAuthenticated) return
    if (classrooms.length === 0) {
      loadStories()
      return
    }
    if (selectedClassroomId !== null) {
      loadStories()
    }
  }, [user, isAuthenticated, selectedClassroomId, classrooms.length])

  useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated && user) {
        loadClassrooms()
        loadStories()
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthenticated, user])

  const handleReadStory = (storyId: string, storyTitle: string) => {
    // Check if story is already submitted
    const story = stories.find(s => s.story_id === storyId)
    if (story && story.submission_status !== 'not_submitted') {
      toast.error('لقد قمت بإرسال إجابات هذه القصة مسبقاً')
      return
    }
    showPageLoader()
    router.push(`/student/read/${storyId}`)
  }

  const handleViewProfile = () => {
    showPageLoader()
    router.push('/student/profile')
  }

  if (!hydrated || !isAuthenticated || isLoading) {
    return (
      <AnimatedBackground>
        <div className="w-full h-full flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="text-2xl font-bold text-ink">جاري التحميل...</p>
          </div>
        </div>
      </AnimatedBackground>
    )
  }

  const studentName = (user as any)?.name || 'طالب'

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="page-container min-h-screen" dir="rtl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-7 max-w-7xl"
        >
          <section className="relative mb-5 overflow-hidden rounded-3xl border border-primary-100 bg-white p-5 shadow-card sm:p-7">
            <div className="absolute -start-8 -top-8 h-28 w-28 rounded-full border-[16px] border-primary-50" aria-hidden="true" />
            <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-extrabold text-primary-700"><Sparkles className="h-4 w-4" />رحلة قراءة جديدة</p>
                <h1 className="text-3xl font-black text-ink md:text-4xl">أهلاً {studentName}</h1>
                <p className="mt-1 text-sm text-slate-600 md:text-base">مرحباً بك في مكتبة القصص الحديثة</p>
              </div>
              <div className="flex w-full gap-2 md:w-auto">
                <Button onClick={() => { showPageLoader(); router.push('/leaderboard') }} variant="outline" size="sm" className="flex-1 md:flex-none">الترتيب</Button>
                <Button onClick={() => { showPageLoader(); router.push('/student/submissions') }} variant="primary" size="sm" className="flex-1 md:flex-none">درجاتي</Button>
              </div>
            </div>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="القصص المقروءة" value={stats.storiesRead} icon={<BookOpen className="h-6 w-6" />} />
            <StatCard label="النماذج المرسلة" value={stats.formsSubmitted} icon={<FileCheck2 className="h-6 w-6" />} tone="success" />
            <button type="button" onClick={handleViewProfile} className="min-h-0 rounded-2xl text-start"><StatCard label="إنجازك الحالي" value={stats.titleName} icon={<Award className="h-6 w-6" />} tone="gold" /></button>
          </div>
        </motion.div>

        {/* Class switcher (multiple classrooms) */}
        {classrooms.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto mb-6"
          >
            <p className="mb-2 text-sm font-extrabold text-slate-700">اختر الفصل</p>
            <div className="flex snap-x gap-2 overflow-x-auto pb-2">
              {classrooms.map((c) => (
                <button
                  key={c.classroom_id}
                  type="button"
                  onClick={() => setSelectedClassroomId(c.classroom_id)}
                  className={`min-w-max snap-start rounded-xl border px-4 py-2 text-sm font-bold transition-[color,background-color,border-color,box-shadow] ${
                    selectedClassroomId === c.classroom_id
                      ? 'border-primary bg-primary text-white shadow-md'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:bg-primary-50'
                  }`}
                >
                  {[c.classroom_name || `الصف ${c.grade}`, c.teacher_name].filter(Boolean).join(' — ')}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stories Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-7xl mx-auto"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><h2 className="flex items-center gap-2 text-2xl font-black text-ink md:text-3xl"><LibraryBig className="h-7 w-7 text-primary" />القصص المتاحة</h2><p className="mt-1 text-sm text-slate-600 md:text-base">اختر قصة واستمتع برحلة القراءة</p></div>
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-extrabold text-primary-700">{stories.length} قصة</span>
          </div>

          {stories.length === 0 ? (
            <EmptyState title="لا توجد قصص متاحة حالياً" description="يرجى التواصل مع معلمك لإضافة قصص جديدة" icon={<BookOpen className="h-6 w-6" />} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {stories.map((story, index) => (
                <motion.div
                  key={story.story_id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <StoryCard
                    story={story}
                    onRead={() => handleReadStory(story.story_id, story.story_title)}
                    isNext={index === 0}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mx-auto mb-8 mt-10 max-w-7xl"
        >
          <Card variant="highlight" className="flex flex-col items-center gap-4 py-6 text-center md:flex-row md:text-start" elevation="sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm"><Target className="h-7 w-7" /></div>
            <div className="flex-1"><h3 className="text-xl font-black text-ink md:text-2xl">هدفك اليومي</h3><p className="mt-1 text-sm text-slate-600 md:text-base">اقرأ قصة واحدة وأرسل نموذجاً لتتقدم في لوحة الترتيب.</p></div>
            <Button size="md" variant="primary">ابدأ الآن</Button>
          </Card>
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
