'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export const AnimatedBackground: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname()
  const student = pathname.startsWith('/student')
  const teacher = pathname.startsWith('/teacher')

  return (
    <div className={cn('app-surface relative min-h-screen w-full overflow-x-hidden', student ? 'student-experience' : 'staff-experience')}>
      <div className={cn('pointer-events-none fixed inset-x-0 top-0 z-0 h-1', teacher ? 'bg-secondary' : student ? 'bg-primary' : 'bg-slate-800')} />
      {student && <><div className="student-motif student-motif--one" /><div className="student-motif student-motif--two" /></>}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default AnimatedBackground
