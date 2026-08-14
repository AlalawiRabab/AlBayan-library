'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { BarChart3, BookOpen, FileText, GraduationCap, Sparkles, Star, Trophy, Users } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import AnimatedBackground from '@/components/AnimatedBackground'
import Card from '@/components/Card'
import PageHeader from '@/components/PageHeader'
import { showPageLoader } from '@/components/PageTransitionLoader'
import { useAppStore } from '@/lib/store'

const dashboardItems = [
  {
    href: '/teacher/students',
    title: 'إدارة الطلاب',
    description: 'إنشاء أكواد وصول الطلاب ومتابعة فصولهم.',
    icon: Users,
    tone: 'bg-primary-50 text-primary-700',
  },
  {
    href: '/teacher/stories',
    title: 'إدارة القصص',
    description: 'إنشاء القصص وتعديلها وتنظيم محتوى القراءة.',
    icon: BookOpen,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    href: '/teacher/forms',
    title: 'إدارة النماذج',
    description: 'بناء نماذج الأسئلة وربطها بالمحتوى المناسب.',
    icon: FileText,
    tone: 'bg-secondary-50 text-secondary-700',
  },
  {
    href: '/teacher/grading',
    title: 'التقييم والتصحيح',
    description: 'مراجعة إجابات الطلاب وإرسال التغذية الراجعة.',
    icon: Star,
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    href: '/teacher/analytics',
    title: 'التحليلات',
    description: 'فهم أداء الفصل ومتابعة تقدّم الطلاب.',
    icon: BarChart3,
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    href: '/leaderboard',
    title: 'جدول الترتيب',
    description: 'عرض ترتيب الطلاب والإنجازات بطريقة محفزة.',
    icon: Trophy,
    tone: 'bg-rose-50 text-rose-700',
  },
] as const

export default function TeacherDashboard() {
  const router = useRouter()
  const { user, userRole, isAuthenticated, hydrated } = useAppStore()

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated || userRole !== 'teacher') router.replace('/')
  }, [hydrated, isAuthenticated, userRole, router])

  const teacherName = (user as { name?: string } | null)?.name || 'معلمنا'

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <main className="page-container min-h-screen" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-7xl">
          <PageHeader
            eyebrow="مساحة المعلم"
            title="لوحة تحكم المعلم"
            description={`مرحباً ${teacherName}، كل ما تحتاجه لإدارة الفصل ومتابعة التعلّم في مكان واحد.`}
            icon={<GraduationCap className="h-6 w-6" />}
          />

          <section aria-labelledby="teacher-tools-title">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 id="teacher-tools-title" className="text-xl font-black text-ink sm:text-2xl">أدوات الفصل</h2>
                <p className="mt-1 text-sm text-slate-600">اختر المهمة التي تريد البدء بها.</p>
              </div>
              <span className="rounded-full bg-secondary-50 px-3 py-1.5 text-xs font-extrabold text-secondary-700">6 أدوات</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboardItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <motion.div key={item.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Link href={item.href} onClick={showPageLoader} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                      <Card variant="interactive" elevation="sm" className="flex min-h-40 items-start gap-4 p-5 text-start">
                        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
                          <Icon className="h-7 w-7" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 pt-1">
                          <span className="block text-lg font-black text-ink">{item.title}</span>
                          <span className="mt-2 block text-sm leading-7 text-slate-600">{item.description}</span>
                        </span>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </section>

          <Card variant="teacher" elevation="sm" className="mt-6 flex flex-col gap-4 overflow-hidden sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary-50 text-secondary-700">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black text-ink">ابدأ بالمهم الآن</h2>
                <p className="mt-1 text-sm leading-7 text-slate-600">راجع الإجابات الجديدة، ثم استخدم التحليلات لرؤية الطلاب الذين يحتاجون إلى دعم.</p>
              </div>
            </div>
            <Link href="/teacher/grading" onClick={showPageLoader} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-5 text-sm font-extrabold text-white hover:bg-secondary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary/20">
              مراجعة الإجابات
            </Link>
          </Card>
        </motion.div>
      </main>
    </AnimatedBackground>
  )
}
