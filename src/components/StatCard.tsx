import React from 'react'
import Card from './Card'

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  hint?: string
  tone?: 'primary' | 'secondary' | 'success' | 'gold' | 'coral'
}

const tones = {
  primary: 'bg-primary-50 text-primary-700',
  secondary: 'bg-secondary-50 text-secondary-700',
  success: 'bg-emerald-50 text-emerald-700',
  gold: 'bg-amber-50 text-amber-700',
  coral: 'bg-rose-50 text-rose-700',
}

export default function StatCard({ label, value, icon, hint, tone = 'primary' }: StatCardProps) {
  return (
    <Card elevation="sm" className="playful-motion flex items-center gap-4 overflow-hidden">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </Card>
  )
}
