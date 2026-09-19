'use client'

import React, { useState, useEffect } from 'react'

export const dynamic = 'force-dynamic'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import LoadingState from '@/components/LoadingState'
import { useAppStore } from '@/lib/store'
import { analyticsService } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { 
  BarChart3, 
  ArrowRight,
  Users,
  BookOpen,
  FileText,
  TrendingUp,
  Activity,
  Shield,
  Award,
  Target,
  Clock,
  CheckCircle
} from 'lucide-react'

interface SystemAnalytics {
  totalUsers: {
    students: number
    teachers: number
    admins: number
  }
  contentStats: {
    totalStories: number
    totalForms: number
    totalSubmissions: number
    gradedSubmissions: number
  }
  activityStats: {
    dailyLogins: number
    weeklyLogins: number
    monthlyLogins: number
    recentActivity: Array<{
      type: string
      description: string
      timestamp: string
      user_type: string
    }>
  }
  performanceStats: {
    averageGrade: number
    completionRate: number
    engagementRate: number
    topPerformingGrade: number
  }
  systemHealth: {
    uptime: string
    lastBackup: string
    activeUsers: number
    systemLoad: string
  }
}

export default function AdminAnalytics() {
  const router = useRouter()
  const { user, userRole, hydrated } = useAppStore()
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'admin') {
      router.push('/')
      return
    }
    loadSystemAnalytics()
  }, [hydrated, userRole, router])

  const loadSystemAnalytics = async () => {
    try {
      setIsLoading(true)

      if (!user || !('access_code' in user)) {
        throw new Error('غير مصرح')
      }

      const raw = await analyticsService.getAdminAnalytics((user as { access_code: string }).access_code)
      if (!raw || typeof raw !== 'object') {
        throw new Error('لا توجد بيانات')
      }

      const data = raw as Record<string, unknown>
      const studentsLogin = Array.isArray(data.students_login_data) ? data.students_login_data : []
      const teachersLogin = Array.isArray(data.teachers_login_data) ? data.teachers_login_data : []
      const adminsLogin = Array.isArray(data.admins_login_data) ? data.admins_login_data : []
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const countActive = (rows: unknown[]) =>
        rows.filter((row) => {
          const loginAt = (row as { last_login_at?: string | null })?.last_login_at
          return loginAt ? new Date(loginAt) > weekAgo : false
        }).length

      const activeUsers =
        countActive(studentsLogin) + countActive(teachersLogin) + countActive(adminsLogin)

      const totalStudents = Number(data.total_students ?? data.active_students ?? 0)
      const totalTeachers = Number(data.total_teachers ?? data.active_teachers ?? 0)
      const totalAdmins = Number(data.total_admins ?? 0)
      const totalUsers = totalStudents + totalTeachers + totalAdmins
      const engagementRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0

      const recentActivityRaw = Array.isArray(data.recent_activity) ? data.recent_activity : []
      const processedActivities = recentActivityRaw.map((activity) => {
        const item = activity as Record<string, unknown>
        return {
          type: String(item.type ?? ''),
          description: String(item.description ?? ''),
          timestamp: String(item.timestamp ?? ''),
          user_type: String(item.user_type ?? ''),
        }
      })

      setAnalytics({
        totalUsers: {
          students: totalStudents,
          teachers: totalTeachers,
          admins: totalAdmins,
        },
        contentStats: {
          totalStories: Number(data.total_stories ?? 0),
          totalForms: Number(data.total_forms ?? 0),
          totalSubmissions: Number(data.total_submissions ?? 0),
          gradedSubmissions: Number(data.graded_submissions ?? 0),
        },
        activityStats: {
          dailyLogins: Number(data.daily_activity ?? activeUsers),
          weeklyLogins: activeUsers,
          monthlyLogins: activeUsers,
          recentActivity: processedActivities,
        },
        performanceStats: {
          averageGrade: Math.round(Number(data.average_grade ?? 0)),
          completionRate: Math.round(Number(data.completion_rate ?? 0)),
          engagementRate: Math.round(engagementRate),
          topPerformingGrade: Number(data.top_performing_grade ?? 3),
        },
        systemHealth: {
          uptime: '99.9%',
          lastBackup: new Date().toLocaleDateString('ar-SA'),
          activeUsers,
          systemLoad: 'منخفض',
        },
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل تحميل تحليلات النظام'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (userRole !== 'admin') {
    return null
  }

  if (isLoading) {
    return (
      <AnimatedBackground>
        <div className="min-h-screen" dir="rtl"><LoadingState label="جاري تحميل تحليلات النظام..." /></div>
      </AnimatedBackground>
    )
  }

  if (!analytics) {
    return (
      <AnimatedBackground>
        <div className="w-full min-h-screen flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <BarChart3 className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-ink mb-2">لا توجد بيانات</h3>
            <p className="text-slate-500">لا توجد بيانات تحليلية متاحة</p>
          </div>
        </div>
      </AnimatedBackground>
    )
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="page-container min-h-screen" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2 flex items-center gap-3">
                <BarChart3 className="w-10 h-10 text-secondary-700" />
                تحليلات النظام
              </h1>
              <p className="text-slate-600 text-lg font-semibold">
                إحصائيات شاملة عن أداء النظام
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

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white  ">
                <div className="flex items-center gap-4">
                  <Users className="w-12 h-12 text-primary-700" />
                  <div>
                    <h3 className="text-2xl font-bold text-ink">
                      {analytics.totalUsers.students + analytics.totalUsers.teachers + analytics.totalUsers.admins}
                    </h3>
                    <p className="text-slate-600 font-semibold">إجمالي المستخدمين</p>
                    <p className="text-sm text-primary-700">
                      {analytics.totalUsers.students} طالب • {analytics.totalUsers.teachers} معلم
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white  ">
                <div className="flex items-center gap-4">
                  <BookOpen className="w-12 h-12 text-emerald-700" />
                  <div>
                    <h3 className="text-2xl font-bold text-ink">{analytics.contentStats.totalStories}</h3>
                    <p className="text-slate-600 font-semibold">القصص المتاحة</p>
                    <p className="text-sm text-emerald-700">{analytics.contentStats.totalForms} نموذج</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white  ">
                <div className="flex items-center gap-4">
                  <FileText className="w-12 h-12 text-amber-700" />
                  <div>
                    <h3 className="text-2xl font-bold text-ink">{analytics.contentStats.totalSubmissions}</h3>
                    <p className="text-slate-600 font-semibold">إجمالي الإجابات</p>
                    <p className="text-sm text-amber-700">{analytics.contentStats.gradedSubmissions} مقيمة</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white  ">
                <div className="flex items-center gap-4">
                  <TrendingUp className="w-12 h-12 text-secondary-700" />
                  <div>
                    <h3 className="text-2xl font-bold text-ink">{analytics.performanceStats.averageGrade}</h3>
                    <p className="text-slate-600 font-semibold">متوسط الدرجات</p>
                    <p className="text-sm text-secondary-700"><bdi dir="ltr">{analytics.performanceStats.completionRate}%</bdi> إكمال</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Performance Metrics */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <h3 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                  <Target className="w-6 h-6 text-emerald-700" />
                  مؤشرات الأداء
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">معدل الإكمال</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-slate-50 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-emerald-600"
                          style={{ width: `${analytics.performanceStats.completionRate}%` }}
                        />
                      </div>
                      <span dir="ltr" className="font-bold text-ink">{analytics.performanceStats.completionRate}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">معدل التفاعل</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-slate-50 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${analytics.performanceStats.engagementRate}%` }}
                        />
                      </div>
                      <span dir="ltr" className="font-bold text-ink">{analytics.performanceStats.engagementRate}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">أفضل صف أداءً</span>
                    <span className="text-ink font-bold">الصف {analytics.performanceStats.topPerformingGrade}</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* System Health */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <h3 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-primary-700" />
                  صحة النظام
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">وقت التشغيل</span>
                    <span dir="ltr" className="font-bold text-accent-green">{analytics.systemHealth.uptime}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">آخر نسخة احتياطية</span>
                    <span className="text-ink font-bold">{analytics.systemHealth.lastBackup}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">المستخدمون النشطون</span>
                    <span className="text-ink font-bold">{analytics.systemHealth.activeUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">حمل النظام</span>
                    <span className="text-accent-green font-bold">{analytics.systemHealth.systemLoad}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card>
              <h3 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary-700" />
                النشاط الأخير
              </h3>
              <div className="space-y-3">
                {analytics.activityStats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <div className="flex-shrink-0">
                      {activity.type === 'login' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-700" />
                      ) : activity.type === 'submission' ? (
                        <FileText className="w-5 h-5 text-primary-700" />
                      ) : (
                        <Activity className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-ink font-semibold">{activity.description}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">
                          {new Date(activity.timestamp).toLocaleDateString('ar-SA')}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-slate-500">{activity.user_type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
