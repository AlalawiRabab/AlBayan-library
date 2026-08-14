import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  compact?: boolean
}

export default function LoadingState({ label = 'جاري التحميل...', compact = false }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 text-slate-600 ${compact ? 'py-4' : 'min-h-56 py-12'}`}>
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-bold">{label}</span>
    </div>
  )
}
