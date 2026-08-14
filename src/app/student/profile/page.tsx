'use client'

import React, { useState, useEffect } from 'react'

export const dynamic = 'force-dynamic'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { Activity, Award, BookOpen, Medal, Trophy } from 'lucide-react'

interface StudentData {
  id: string
  name: string
  stories_read: number
  forms_submitted: number
  total_reading_time_minutes: number
  current_title: {
    name_arabic: string
    icon_emoji: string
    rank: number
  } | null
}

interface Achievement {
  id: string
  name_arabic: string
  icon_emoji: string
  rank: number
  min_stories_read: number
  min_forms_submitted: number
  earned: boolean
}

export default function StudentProfile() {
  const router = useRouter()
  const { user, isAuthenticated, hydrated } = useAppStore()
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [averageGrade, setAverageGrade] = useState<number | null>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (hydrated && isAuthenticated && user) {
      loadStudentData()
    }
  }, [hydrated, isAuthenticated, user])

  const loadStudentData = async () => {
    try {
      setIsLoading(true)
      const accessCode = (user as any)?.access_code

      if (!accessCode) {
        console.error('No access code found')
        return
      }

      // Fetch student data with current title
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          stories_read,
          forms_submitted,
          total_reading_time_minutes,
          current_title_id,
          achievement_titles!students_current_title_id_fkey (
            name_arabic,
            icon_emoji,
            rank
          )
        `)
        .eq('access_code', accessCode)
        .single()

      if (studentError) {
        console.error('Error fetching student:', studentError)
        return
      }

      // Format student data
      const titleData = student.achievement_titles as any
      setStudentData({
        id: student.id,
        name: student.name || 'طالب',
        stories_read: student.stories_read || 0,
        forms_submitted: student.forms_submitted || 0,
        total_reading_time_minutes: student.total_reading_time_minutes || 0,
        current_title: titleData ? {
          name_arabic: titleData.name_arabic,
          icon_emoji: titleData.icon_emoji,
          rank: titleData.rank
        } : null
      })

      // Fetch all achievement titles
      const { data: allTitles, error: titlesError } = await supabase
        .from('achievement_titles')
        .select('*')
        .order('rank', { ascending: true })

      if (!titlesError && allTitles) {
        // Determine which achievements are earned
        const earnedAchievements = allTitles.map(title => ({
          ...title,
          earned: (student.stories_read || 0) >= title.min_stories_read && 
                  (student.forms_submitted || 0) >= title.min_forms_submitted
        }))
        setAchievements(earnedAchievements)
      }

      // Fetch average grade from submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('student_submissions')
        .select('grade')
        .eq('student_id', student.id)
        .not('grade', 'is', null)

      if (!submissionsError && submissions && submissions.length > 0) {
        const total = submissions.reduce((sum, sub) => sum + (sub.grade || 0), 0)
        setAverageGrade(Math.round(total / submissions.length))
      }

      // Fetch recent activity (last 5 submissions)
      const { data: recent, error: recentError } = await supabase
        .from('student_submissions')
        .select(`
          id,
          submitted_at,
          grade,
          stories!student_submissions_story_id_fkey (
            title_arabic
          )
        `)
        .eq('student_id', student.id)
        .order('submitted_at', { ascending: false })
        .limit(5)

      if (!recentError && recent) {
        setRecentActivity(recent.map(item => ({
          action: `أرسلت نموذج: ${(item.stories as any)?.title_arabic || 'قصة'}`,
          date: formatDate(item.submitted_at),
          grade: item.grade
        })))
      }

    } catch (error) {
      console.error('Error loading student data:', error)
      toast.error('فشل تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'اليوم'
    if (diffDays === 1) return 'أمس'
    if (diffDays < 7) return `قبل ${diffDays} أيام`
    return date.toLocaleDateString('ar-SA')
  }

  const formatReadingTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} دقيقة`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) return `${hours} ساعة`
    return `${hours}س ${mins}د`
  }

  if (!hydrated || !isAuthenticated || isLoading) {
    return (
      <AnimatedBackground>
        <div className="min-h-screen" dir="rtl"><LoadingState /></div>
      </AnimatedBackground>
    )
  }

  const studentName = studentData?.name || (user as any)?.name || 'طالب'
  const currentTitle = studentData?.current_title
  const storiesRead = studentData?.stories_read || 0
  const formsSubmitted = studentData?.forms_submitted || 0
  const readingTime = studentData?.total_reading_time_minutes || 0

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="page-container min-h-screen" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <PageHeader title="ملفك الشخصي" description="تابع إنجازاتك وتقدّمك في القراءة." backHref="/student" icon={<Trophy className="h-6 w-6" />} />

          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="text-center py-8 mb-8" elevation="md">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-700"><Trophy className="h-10 w-10" aria-hidden="true" /></div>
              <h2 className="text-3xl font-bold text-ink mb-2">{studentName}</h2>
              <p className="text-xl text-primary font-semibold mb-4">
                {currentTitle?.name_arabic || 'قارئ مبتدئ'}
              </p>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">{storiesRead}</div>
                  <p className="text-slate-600 text-sm">قصص مقروءة</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-accent-green">{formsSubmitted}</div>
                  <p className="text-slate-600 text-sm">نماذج مرسلة</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Achievements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h3 className="mb-4 flex items-center gap-2 text-2xl font-bold text-ink"><Award className="h-6 w-6 text-amber-700" />إنجازاتك</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {achievements.map((achievement, i) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                >
                  <Card
                    className={`text-center py-4 ${
                      achievement.earned ? '' : 'opacity-40 grayscale'
                    }`}
                    elevation="sm"
                  >
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-50 text-secondary-700"><Medal className="h-6 w-6" aria-hidden="true" /></div>
                    <p className="text-sm font-bold">{achievement.name_arabic}</p>
                    {achievement.earned && (
                      <span className="text-xs text-accent-green"> مكتسب</span>
                    )}
                    {!achievement.earned && (
                      <span className="text-xs text-slate-500">
                        {achievement.min_stories_read} قصص / {achievement.min_forms_submitted} نماذج
                      </span>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Statistics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h3 className="mb-4 flex items-center gap-2 text-2xl font-bold text-ink"><BookOpen className="h-6 w-6 text-primary" />إحصائياتك</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card elevation="sm" padding="lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-600">القصص المقروءة</span>
                  <span className="text-3xl font-bold text-primary">{storiesRead}</span>
                </div>
                <div className="w-full bg-slate-50 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (storiesRead / 25) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">الهدف: 25 قصة</p>
              </Card>

              <Card elevation="sm" padding="lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-600">النماذج المرسلة</span>
                  <span className="text-3xl font-bold text-accent-green">{formsSubmitted}</span>
                </div>
                <div className="w-full bg-slate-50 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-accent-green transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (formsSubmitted / 20) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">الهدف: 20 نموذج</p>
              </Card>

              <Card elevation="sm" padding="lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-600">وقت القراءة الإجمالي</span>
                  <span className="text-3xl font-bold text-secondary">
                    {formatReadingTime(readingTime)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {readingTime > 0 ? 'رائع! استمر في القراءة' : 'ابدأ القراءة الآن!'}
                </p>
              </Card>

              <Card elevation="sm" padding="lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-600">متوسط الدرجات</span>
                  <span dir="ltr" className={`text-3xl font-bold ${
                    averageGrade === null ? 'text-slate-500' :
                    averageGrade >= 80 ? 'text-accent-green' :
                    averageGrade >= 60 ? 'text-amber-700' : 'text-accent-red'
                  }`}>
                    {averageGrade !== null ? `${averageGrade}%` : '-'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {averageGrade === null ? 'لا توجد درجات بعد' :
                   averageGrade >= 80 ? 'أداء ممتاز!' :
                   averageGrade >= 60 ? 'جيد، استمر!' : 'حاول أكثر!'}
                </p>
              </Card>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="mb-4 flex items-center gap-2 text-2xl font-bold text-ink"><Activity className="h-6 w-6 text-emerald-700" />نشاطك الأخير</h3>
            <Card elevation="sm">
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((item, i) => (
                    <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-200 last:border-0 last:pb-0">
                      <div>
                        <span className="text-slate-600">{item.action}</span>
                        {item.grade !== null && (
                          <span dir="ltr" className={`me-2 text-sm px-2 py-0.5 rounded ${
                            item.grade >= 80 ? 'bg-emerald-50 text-emerald-700' :
                            item.grade >= 60 ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {item.grade}%
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-slate-500">{item.date}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Activity className="h-6 w-6" aria-hidden="true" /></div>
                  <p>لا يوجد نشاط بعد. ابدأ بقراءة قصة!</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <Button
              onClick={() => router.push('/student')}
              size="lg"
              variant="primary"
            >
              العودة إلى القصص
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
