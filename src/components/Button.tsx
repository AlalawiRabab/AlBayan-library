import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent font-bold leading-none shadow-sm transition-[color,background-color,border-color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 active:translate-y-px',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:-translate-y-0.5 hover:bg-primary-600 hover:shadow-hover active:bg-primary-700',
        secondary: 'bg-secondary text-white hover:-translate-y-0.5 hover:bg-secondary-600 active:bg-secondary-700',
        success: 'bg-success text-white hover:-translate-y-0.5 hover:bg-emerald-700 active:bg-emerald-800',
        danger: 'bg-error text-white hover:bg-rose-700 active:bg-rose-800',
        outline: 'border-primary/35 bg-white text-primary-700 hover:border-primary hover:bg-primary-50',
        ghost: 'border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-ink',
      },
      size: {
        xs: 'min-h-11 px-3 py-2 text-xs',
        sm: 'min-h-11 px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base min-h-[44px]',
        lg: 'px-8 py-4 text-lg min-h-[54px]',
        xl: 'px-10 py-5 text-xl min-h-[64px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, icon, children, disabled, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      ref={ref}
      {...props}
    >
      {isLoading && (
        <svg
          className="h-5 w-5 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {icon && !isLoading && icon}
      {children}
    </button>
  )
)

Button.displayName = 'Button'

export default Button
