'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import StoryCard from '@/components/StoryCard'
import { useAppStore } from '@/lib/store'
import { storiesService, studentsService, supabase } from '@/lib/supabase'
import { StudentClassroom } from '@/types'
import toast, { Toaster } from 'react-hot-toast'
import { showPageLoader } from '@/components/PageTransitionLoader'

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

      // Load aggregated statistics
      let storiesReadCount = 0
      let formsSubmittedCount = 0

      try {
        const { data: statsRow, error: statsError } = await supabase
          .from('student_statistics')
          .select('stories_easy, stories_medium, stories_hard, total_submissions')
          .eq('student_id', studentData.id)
          .single()

        if (statsError) {
          console.warn('Unable to load student statistics, falling back to derived counts:', statsError)
        }

        if (statsRow) {
          storiesReadCount =
            (statsRow.stories_easy ?? 0) +
            (statsRow.stories_medium ?? 0) +
            (statsRow.stories_hard ?? 0)
          formsSubmittedCount = statsRow.total_submissions ?? 0
        }
      } catch (statsFetchError) {
        console.warn('Error fetching student statistics:', statsFetchError)
      }

      if (storiesReadCount === 0) {
        storiesReadCount =
          fetchedStories?.filter((story: any) => story.submission_status !== 'not_submitted').length || 0
      }

      if (formsSubmittedCount === 0) {
        formsSubmittedCount =
          fetchedStories?.filter((story: any) => story.submission_status !== 'not_submitted').length || 0
      }

      setStats(prev => ({
        ...prev,
        storiesRead: storiesReadCount,
        formsSubmitted: formsSubmittedCount
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

  const handleLogout = () => {
    const { logout } = useAppStore.getState()
    logout()
    showPageLoader()
    router.push('/')
  }

  if (!hydrated || !isAuthenticated || isLoading) {
    return (
      <AnimatedBackground>
        <div className="w-full h-full flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">📚</div>
            <p className="text-2xl font-bold text-white">جاري التحميل...</p>
          </div>
        </div>
      </AnimatedBackground>
    )
  }

  const studentName = (user as any)?.name || 'طالب'

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="w-full min-h-screen p-4 md:p-6" dir="rtl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto mb-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
                أهلاً {studentName} 👋
              </h1>
              <p className="text-gray-200 text-sm md:text-lg">رحباً بك في مكتبة القصص الحديثة</p>
            </div>
            <div className="flex gap-2 md:gap-3 w-full md:w-auto">
              <Button
                onClick={() => {
                  showPageLoader()
                  router.push('/leaderboard')
                }}
                variant="outline"
                size="sm"
                className="flex-1 md:flex-none"
              >
                الترتيب
              </Button>
              <Button
                onClick={() => {
                  showPageLoader()
                  router.push('/student/submissions')
                }}
                variant="primary"
                size="sm"
                className="flex-1 md:flex-none"
              >
                درجاتي
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="flex-1 md:flex-none"
              >
                تسجيل خروج
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="text-center" elevation="sm">
                <div className="text-5xl mb-2">📖</div>
                <p className="text-gray-200 text-sm mb-1">القصص المقروءة</p>
                <p className="text-3xl font-bold text-primary">{stats.storiesRead}</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="text-center" elevation="sm">
                <div className="text-5xl mb-2">✏️</div>
                <p className="text-gray-200 text-sm mb-1">النماذج المرسلة</p>
                <p className="text-3xl font-bold text-accent-green">{stats.formsSubmitted}</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              onClick={handleViewProfile}
              className="cursor-pointer"
            >
              <Card className="text-center hover:shadow-hover transition-all" elevation="sm">
                <div className="text-5xl mb-2">👑</div>
                <p className="text-gray-200 text-sm mb-1">إنجازك الحالي</p>
                <p className="text-lg font-bold text-secondary">{stats.titleName}</p>
              </Card>
            </motion.div>
          </div>
        </motion.div>

        {/* Class switcher (multiple classrooms) */}
        {classrooms.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto mb-6"
          >
            <p className="text-gray-200 text-sm mb-2">اختر الفصل</p>
            <div className="flex flex-wrap gap-2">
              {classrooms.map((c) => (
                <button
                  key={c.classroom_id}
                  type="button"
                  onClick={() => setSelectedClassroomId(c.classroom_id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedClassroomId === c.classroom_id
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-white/10 text-gray-200 hover:bg-white/20'
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
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">🌟 القصص المتاحة</h2>
            <p className="text-gray-200 text-sm md:text-lg">اختر قصة واستمتع برحلة القراءة</p>
          </div>

          {stories.length === 0 ? (
            <Card className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-2xl font-bold text-white mb-2">لا توجد قصص متاحة حالياً</h3>
              <p className="text-gray-200">يرجى الاتصال بمعلمك لإنشاء قصص جديدة</p>
            </Card>
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
          className="max-w-7xl mx-auto mt-12 mb-8"
        >
            <Card
            className="bg-gradient-to-r from-primary/20 to-secondary/20 text-center py-6 md:py-8"
            elevation="md"
          >
            <div className="text-4xl md:text-5xl mb-3 md:mb-4">🎯</div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">هدفك اليومي</h3>
            <p className="text-gray-200 mb-4 text-sm md:text-base px-4">اقرأ قصة واحدة وأرسل نموذج لكسب نقاط!</p>
            <Button size="md" variant="primary" className="text-sm md:text-base">
              ابدأ الآن
            </Button>
          </Card>
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
