import React from 'react'
import Card from './Card'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card variant="subtle" className="py-12 text-center">
      {icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-100 bg-white text-primary shadow-sm">{icon}</div>}
      <h3 className="text-lg font-extrabold text-ink">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  )
}
