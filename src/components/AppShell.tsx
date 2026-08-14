'use client'

import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { showPageLoader } from './PageTransitionLoader'
import { cn } from '@/lib/utils'

export type AppRole = 'admin' | 'teacher' | 'student'

export interface AppBreadcrumb {
  label: string
  href?: string
}

export interface AppShellProps {
  role: AppRole
  title?: string
  subtitle?: string
  breadcrumbs?: AppBreadcrumb[]
  actions?: React.ReactNode
  focused?: boolean
  children: React.ReactNode
}

interface NavigationItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navigation: Record<AppRole, NavigationItem[]> = {
  admin: [
    { label: 'الرئيسية', href: '/admin', icon: LayoutDashboard },
    { label: 'المعلمون', href: '/admin/teachers', icon: Users },
    { label: 'الأذونات', href: '/admin/permissions', icon: ShieldCheck },
    { label: 'الصفوف', href: '/admin/grades', icon: GraduationCap },
    { label: 'التحليلات', href: '/admin/analytics', icon: BarChart3 },
  ],
  teacher: [
    { label: 'الرئيسية', href: '/teacher', icon: LayoutDashboard },
    { label: 'الطلاب', href: '/teacher/students', icon: Users },
    { label: 'القصص', href: '/teacher/stories', icon: BookOpen },
    { label: 'النماذج', href: '/teacher/forms', icon: FileText },
    { label: 'التقييم', href: '/teacher/grading', icon: ClipboardCheck },
    { label: 'التحليلات', href: '/teacher/analytics', icon: BarChart3 },
    { label: 'الترتيب', href: '/leaderboard', icon: Trophy },
  ],
  student: [
    { label: 'مكتبتي', href: '/student', icon: BookOpen },
    { label: 'درجاتي', href: '/student/submissions', icon: ClipboardCheck },
    { label: 'ملفي', href: '/student/profile', icon: UserRound },
    { label: 'الترتيب', href: '/leaderboard', icon: Trophy },
  ],
}

const roleLabels: Record<AppRole, string> = {
  admin: 'مسؤول النظام',
  teacher: 'حساب المعلم',
  student: 'حساب الطالب',
}

const roleStyles: Record<AppRole, { active: string; mark: string; experience: string }> = {
  admin: { active: 'bg-slate-800 text-white', mark: 'bg-amber-50 text-amber-700', experience: 'staff-experience' },
  teacher: { active: 'bg-secondary text-white', mark: 'bg-secondary-50 text-secondary-700', experience: 'staff-experience' },
  student: { active: 'bg-primary text-white', mark: 'bg-primary-50 text-primary-700', experience: 'student-experience' },
}

export default function AppShell({ role, title, subtitle, breadcrumbs, actions, focused = false, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAppStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const focusedStudentFlow = role === 'student' && (/^\/student\/(read|submit)\//.test(pathname) || focused)

  useEffect(() => setMenuOpen(false), [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false)
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  const activeItem = useMemo(() => {
    const items = navigation[role]
    return items
      .filter(item => item.href === pathname || (item.href !== `/${role}` && pathname.startsWith(`${item.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0] || items[0]
  }, [pathname, role])

  const userName = (user as { name?: string } | null)?.name || roleLabels[role]
  const styles = roleStyles[role]

  const handleNavigation = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href === pathname) {
      event.preventDefault()
      return
    }
    showPageLoader()
  }

  const handleLogout = () => {
    logout()
    showPageLoader()
    router.push('/')
  }

  if (focusedStudentFlow) {
    return <div className="student-experience min-h-screen bg-cloud">{children}</div>
  }

  const Navigation = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="space-y-1.5" aria-label="التنقل الرئيسي">
      {navigation[role].map(item => {
        const Icon = item.icon
        const active = item.href === pathname || (item.href !== `/${role}` && pathname.startsWith(`${item.href}/`))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={event => handleNavigation(event, item.href)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-extrabold transition-[color,background-color,box-shadow]',
              active ? `${styles.active} shadow-sm` : 'text-slate-600 hover:bg-slate-100 hover:text-ink',
              mobile && 'text-base'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
            {active && <ChevronLeft className="ms-auto h-4 w-4" />}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className={cn('min-h-screen bg-cloud', styles.experience)}>
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-5">
          <Image src="/logow.png" alt="البيان" width={88} height={56} priority className="h-14 w-[88px] object-contain" />
          <div className="min-w-0">
            <p className="font-heading text-lg font-black text-ink">البيان</p>
            <p className="truncate text-xs font-bold text-slate-500">{roleLabels[role]}</p>
          </div>
        </div>
        <div className="mt-5 flex-1 overflow-y-auto"><Navigation /></div>
        <div className="border-t border-slate-100 pt-4">
          <div className={cn('mb-3 rounded-2xl px-3 py-3', styles.mark)}>
            <p className="truncate text-sm font-black">{userName}</p>
            <p className="mt-0.5 text-xs opacity-75">{roleLabels[role]}</p>
          </div>
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-rose-50 hover:text-rose-700">
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className={cn('min-h-screen lg:ps-64', role === 'student' && 'pb-24 lg:pb-0')}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 py-2 shadow-[0_1px_0_rgba(23,37,58,0.02)] sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {role !== 'student' && (
              <button type="button" onClick={() => setMenuOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="فتح القائمة">
                <Menu className="h-6 w-6" />
              </button>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ink sm:text-base">{title || activeItem.label}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle || `مرحباً ${userName}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {breadcrumbs && breadcrumbs.length > 0 && <span className="hidden text-xs text-slate-500 xl:block">{breadcrumbs.map(item => item.label).join(' / ')}</span>}
            {actions}
            <Image src="/logow.png" alt="البيان" width={64} height={40} className="h-10 w-16 object-contain lg:hidden" />
          </div>
        </header>
        <main>{children}</main>
      </div>

      {role === 'student' && (
        <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(23,37,58,0.08)] lg:hidden">
          {navigation.student.map(item => {
            const Icon = item.icon
            const active = item.href === pathname || (item.href !== '/student' && pathname.startsWith(`${item.href}/`))
            return (
              <Link key={item.href} href={item.href} onClick={event => handleNavigation(event, item.href)} aria-current={active ? 'page' : undefined} className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold', active ? 'bg-primary-50 text-primary-700' : 'text-slate-500')}>
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {menuOpen && role !== 'student' && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="إغلاق القائمة" className="absolute inset-0 min-h-0 bg-slate-950/40" onClick={() => setMenuOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="قائمة التنقل" className="absolute inset-y-0 start-0 w-[min(88vw,340px)] overflow-y-auto border-e border-slate-200 bg-white p-4 shadow-lg">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <Image src="/logow.png" alt="البيان" width={80} height={48} className="h-12 w-20 object-contain" />
                <div><p className="font-black text-ink">البيان</p><p className="text-xs text-slate-500">{roleLabels[role]}</p></div>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100" aria-label="إغلاق القائمة"><X className="h-6 w-6" /></button>
            </div>
            <Navigation mobile />
            <button type="button" onClick={handleLogout} className="mt-6 flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-700">
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
