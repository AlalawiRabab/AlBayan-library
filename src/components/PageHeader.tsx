import Link from 'next/link'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import React from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderBreadcrumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  icon?: React.ReactNode
  backHref?: string
  breadcrumbs?: PageHeaderBreadcrumb[]
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({ title, description, eyebrow, icon, backHref, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="مسار الصفحة" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              {index > 0 && <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
              {item.href ? <Link href={item.href} className="rounded-md px-1 py-1 hover:text-primary">{item.label}</Link> : <span aria-current="page">{item.label}</span>}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {backHref && (
            <Link href={backHref} aria-label="العودة" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700">
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
          {icon && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">{icon}</div>}
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 text-xs font-extrabold text-primary-700">{eyebrow}</p>}
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
            {description && <p className="mt-1.5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
