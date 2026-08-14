'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

let setGlobalLoading: ((loading: boolean) => void) | null = null

export function showPageLoader() {
  setGlobalLoading?.(true)
}

export function hidePageLoader() {
  setGlobalLoading?.(false)
}

export default function PageTransitionLoader() {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)

  useEffect(() => {
    setGlobalLoading = setIsLoading
    return () => { setGlobalLoading = null }
  }, [])

  useEffect(() => {
    if (pathname !== prevPathname) {
      setIsLoading(false)
      setPrevPathname(pathname)
    }
  }, [pathname, prevPathname])

  useEffect(() => {
    if (!isLoading) return
    const safetyTimer = setTimeout(() => setIsLoading(false), 3000)
    return () => clearTimeout(safetyTimer)
  }, [isLoading])

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
        >
          <div className="rounded-2xl border border-slate-200 bg-white px-10 py-8 text-center shadow-lg">
            <Image src="/logow.png" alt="البيان" width={144} height={80} className="mx-auto h-20 w-36 object-contain" />
            <div className="mt-4 flex items-center justify-center gap-2 text-primary-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-bold">جاري التحميل...</span>
            </div>
          </div>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
            className="absolute inset-x-0 top-0 h-1 origin-right bg-primary"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
