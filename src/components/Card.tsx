import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  elevation?: 'none' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'interactive' | 'subtle' | 'highlight' | 'student' | 'teacher' | 'admin'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, padding = 'md', elevation = 'md', variant = 'default', ...props }, ref) => {
    const paddingClasses = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-7',
    }

    const elevationClasses = {
      none: '',
      sm: 'shadow-card',
      md: 'shadow-hover',
      lg: 'shadow-lg',
    }

    const variantClasses = {
      default: 'bg-white border-slate-200',
      interactive: 'bg-white border-slate-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-hover',
      subtle: 'bg-slate-50 border-slate-200',
      highlight: 'bg-primary-50 border-primary/20',
      student: 'bg-white border-primary-100 shadow-card',
      teacher: 'bg-white border-secondary-100 shadow-card',
      admin: 'bg-white border-slate-200 shadow-card',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border text-ink transition-[transform,border-color,box-shadow] duration-200',
          variantClasses[variant],
          paddingClasses[padding],
          elevationClasses[elevation],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
