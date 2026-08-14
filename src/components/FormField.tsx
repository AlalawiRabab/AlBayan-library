import React from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({ id, label, hint, error, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="block text-sm font-extrabold text-slate-700">
        {label}
        {required && <span className="ms-1 text-error" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? <p id={`${id}-error`} role="alert" className="text-xs font-bold text-error">{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs leading-6 text-slate-500">{hint}</p> : null}
    </div>
  )
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('form-control', className)} {...props} />
))
TextInput.displayName = 'TextInput'

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('form-control min-h-28 resize-y', className)} {...props} />
))
TextArea.displayName = 'TextArea'

export const SelectInput = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('form-control', className)} {...props} />
))
SelectInput.displayName = 'SelectInput'
