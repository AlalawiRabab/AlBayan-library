'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Activity, BarChart3, BookOpen, FileText, GraduationCap, Settings, Shield, Users } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import AnimatedBackground from '@/components/AnimatedBackground'
import Card from '@/components/Card'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import { showPageLoader } from '@/components/PageTransitionLoader'
import { analyticsService } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'

interface AdminAnalytics {
  total_students: number
  total_teachers: number
  total_stories: number
  total_forms: number
  total_submissions: number
  daily_activity: number
  active_students: number
  active_teachers: number
  graded_submissions: number
  pending_submissions: number
  total_classrooms: number
}

const adminItems = [
  { href: '/admin/teachers', title: 'إدارة المعلمين', description: 'إنشاء حسابات المعلمين ومتابعة نشاطهم.', icon: Users, tone: 'bg-primary-50 text-primary-700' },
  { href: '/admin/permissions', title: 'الأذونات', description: 'ضبط صلاحيات الوصول لكل معلم بأمان.', icon: Shield, tone: 'bg-secondary-50 text-secondary-700' },
  { href: '/admin/analytics', title: 'التحليلات', description: 'عرض مؤشرات النظام والمدارس والفصول.', icon: BarChart3, tone: 'bg-violet-50 text-violet-700' },
  { href: '/admin/grades', title: 'إدارة الصفوف', description: 'تنظيم الصفوف والمحتوى والمعلمين.', icon: GraduationCap, tone: 'bg-emerald-50 text-emerald-700' },
] as const

export default function AdminDashboard() {
  const router = useRouter()
  const { user, userRole, isAuthenticated, hydrated } = useAppStore()
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated || userRole !== 'admin') {
      router.replace('/')
      return
    }
    void loadAnalytics()
  }, [hydrated, isAuthenticated, userRole, router])

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      if (!user || !('access_code' in user)) {
        toast.error('خطأ في بيانات المستخدم')
        return
      }
      const data = await analyticsService.getAdminAnalytics((user as { access_code: string }).access_code)
      if (!data) {
        toast.error('لا توجد بيانات متاحة')
        return
      }
      setAnalytics(data)
    } catch (error) {
      console.error('Error loading admin analytics:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const adminName = (user as { name?: string } | null)?.name || 'المسؤول'
  const loadingValue = <span className="inline-block h-7 w-12 animate-pulse rounded-lg bg-slate-200" aria-label="جارٍ التحميل" />

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <main className="page-container min-h-screen" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl">
          <PageHeader
            eyebrow="إدارة النظام"
            title="لوحة تحكم الإدارة"
            description={`مرحباً ${adminName}، راقب النظام وأدر الصلاحيات والمحتوى من لوحة واضحة وآمنة.`}
            icon={<Shield className="h-6 w-6" />}
          />

          <section aria-labelledby="system-stats-title" className="mb-8">
            <h2 id="system-stats-title" className="sr-only">إحصاءات النظام</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="المعلمون" value={isLoading ? loadingValue : analytics?.total_teachers || 0} icon={<GraduationCap className="h-6 w-6" />} />
              <StatCard label="الطلاب" value={isLoading ? loadingValue : analytics?.total_students || 0} icon={<Users className="h-6 w-6" />} tone="success" />
              <StatCard label="القصص" value={isLoading ? loadingValue : analytics?.total_stories || 0} icon={<BookOpen className="h-6 w-6" />} tone="secondary" />
              <StatCard label="النشاط اليومي" value={isLoading ? loadingValue : analytics?.daily_activity || 0} icon={<Activity className="h-6 w-6" />} tone="gold" />
            </div>
          </section>

          <section aria-labelledby="admin-tools-title">
            <div className="mb-4">
              <h2 id="admin-tools-title" className="text-xl font-black text-ink sm:text-2xl">إدارة المنصة</h2>
              <p className="mt-1 text-sm text-slate-600">اختصارات واضحة للمهام الإدارية اليومية.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {adminItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <motion.div key={item.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Link href={item.href} onClick={showPageLoader} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                      <Card variant="interactive" elevation="sm" className="flex min-h-40 items-start gap-4 p-5 text-start">
                        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}><Icon className="h-7 w-7" aria-hidden="true" /></span>
                        <span className="min-w-0 pt-1">
                          <span className="block text-lg font-black text-ink">{item.title}</span>
                          <span className="mt-2 block text-sm leading-7 text-slate-600">{item.description}</span>
                        </span>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })}

              <button type="button" onClick={() => toast('الإعدادات المتقدمة قريباً')} className="rounded-2xl text-start focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                <Card variant="subtle" elevation="none" className="flex min-h-40 items-start gap-4 p-5">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-600"><Settings className="h-7 w-7" aria-hidden="true" /></span>
                  <span className="min-w-0 pt-1"><span className="block text-lg font-black text-ink">الإعدادات</span><span className="mt-2 block text-sm leading-7 text-slate-600">إعدادات النظام المتقدمة ستتوفر قريباً.</span></span>
                </Card>
              </button>

              <button type="button" onClick={() => toast('التقارير المتقدمة قريباً')} className="rounded-2xl text-start focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                <Card variant="subtle" elevation="none" className="flex min-h-40 items-start gap-4 p-5">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><FileText className="h-7 w-7" aria-hidden="true" /></span>
                  <span className="min-w-0 pt-1"><span className="block text-lg font-black text-ink">التقارير</span><span className="mt-2 block text-sm leading-7 text-slate-600">تقارير إدارية قابلة للتخصيص ستتوفر قريباً.</span></span>
                </Card>
              </button>
            </div>
          </section>

          <Card variant="admin" elevation="sm" className="mt-6 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Shield className="h-6 w-6" aria-hidden="true" /></span>
            <div><h2 className="text-lg font-black text-ink">نظرة سريعة وآمنة</h2><p className="mt-1 text-sm leading-7 text-slate-600">استخدم التحليلات لمراجعة النشاط، ثم انتقل إلى الأذونات عند الحاجة إلى تعديل وصول المعلمين.</p></div>
          </Card>
        </motion.div>
      </main>
    </AnimatedBackground>
  )
}
