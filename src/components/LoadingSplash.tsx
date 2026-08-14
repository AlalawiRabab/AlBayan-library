'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export default function LoadingSplash() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cloud px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <Image src="/logow.png" alt="البيان" width={160} height={96} priority className="mx-auto mb-5 h-24 w-40 object-contain" />
        <h1 className="font-heading text-2xl font-extrabold text-ink">البيان</h1>
        <p className="mt-1 text-sm text-slate-500">منصة تعليمية تفاعلية</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-primary-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold">جاري التحميل...</span>
        </div>
      </div>
    </div>
  )
}
