import React from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  primary: 'border-primary/20 bg-primary-50 text-primary-700',
  secondary: 'border-secondary/20 bg-secondary-50 text-secondary-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
}

export function Badge({ tone = 'neutral', className, children }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold', tones[tone], className)}>{children}</span>
}

export default Badge
