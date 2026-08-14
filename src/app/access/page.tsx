'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { useAppStore } from '@/lib/store'
import { authService } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { Shield, GraduationCap, LogIn, UserCheck, ArrowRight } from 'lucide-react'
import { showPageLoader } from '@/components/PageTransitionLoader'
import Dialog from '@/components/Dialog'
import { FormField, TextInput } from '@/components/FormField'

export default function AccessPortalPage() {
  const router = useRouter()
  const { setUser, setError, setLoading } = useAppStore()
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginType, setLoginType] = useState<'admin' | 'teacher'>('admin')
  const [accessCode, setAccessCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoading(true)

    try {
      const result = await authService.loginWithAccessCode(accessCode)
      setUser(result.user, result.type)
      
      if (result.type === 'admin') {
        toast.success('مرحباً أيها المسؤول! ')
        showPageLoader()
        router.push('/admin')
      } else if (result.type === 'teacher') {
        toast.success(`مرحباً ${result.user.name}! `)
        showPageLoader()
        router.push('/teacher')
      } else {
        toast.error('رمز الدخول غير صحيح')
        setIsLoading(false)
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message)
      toast.error(error.message)
      setIsLoading(false)
      setLoading(false)
    }
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="flex min-h-screen w-full items-center justify-center px-4 py-10 sm:px-6" dir="rtl">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 text-center"
          >
            <div className="flex flex-col items-center gap-2 mb-4">
              <Image
                src="/logow.png" 
                alt="البيان" 
                width={192}
                height={112}
                priority
                className="h-24 w-40 object-contain md:h-28 md:w-48"
              />
              <h1 className="font-heading text-3xl font-extrabold text-ink md:text-4xl">
                بوابة الإدارة
              </h1>
            </div>
            <p className="text-slate-600 text-lg">
              دخول المسؤولين والمعلمين
            </p>
          </motion.div>

          {/* Login Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
          >
            {/* Admin Login */}
            <Card className="p-6 text-center md:p-8" variant="interactive">
              <Shield className="w-16 h-16 md:w-20 md:h-20 text-primary mx-auto mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-ink mb-2">دخول المسؤول</h3>
              <p className="text-slate-600 mb-4 text-base">إدارة النظام والمعلمين</p>
              <Button
                onClick={() => {
                  setLoginType('admin')
                  setShowLoginForm(true)
                }}
                variant="primary"
                size="lg"
                className="w-full text-lg"
                icon={<LogIn className="w-5 h-5" />}
              >
                دخول المسؤول
              </Button>
            </Card>

            {/* Teacher Login */}
            <Card className="p-6 text-center md:p-8" variant="interactive">
              <GraduationCap className="w-16 h-16 md:w-20 md:h-20 text-secondary mx-auto mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-ink mb-2">دخول المعلم</h3>
              <p className="text-slate-600 mb-4 text-base">إدارة الطلاب والقصص</p>
              <Button
                onClick={() => {
                  setLoginType('teacher')
                  setShowLoginForm(true)
                }}
                variant="secondary"
                size="lg"
                className="w-full text-lg"
                icon={<UserCheck className="w-5 h-5" />}
              >
                دخول المعلم
              </Button>
            </Card>
          </motion.div>

          {/* Back to Home Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
          >
            <Button
              onClick={() => {
                showPageLoader()
                router.push('/')
              }}
              variant="ghost"
              size="md"
              icon={<ArrowRight className="w-5 h-5" />}
            >
              العودة للصفحة الرئيسية
            </Button>
          </motion.div>

          <Dialog open={showLoginForm} onOpenChange={setShowLoginForm} title={loginType === 'admin' ? 'دخول المسؤول' : 'دخول المعلم'} description="استخدم رمز الوصول الخاص بحسابك." size="sm">
                <form onSubmit={handleLogin} className="space-y-6">
                  <FormField id="staff-access-code" label="رمز الدخول" required>
                    <TextInput
                      id="staff-access-code"
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      className="ltr-isolate font-mono text-base font-bold tracking-wider"
                      placeholder="أدخل رمز الدخول"
                      maxLength={16}
                      required
                      disabled={isLoading}
                    />
                  </FormField>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="flex-1 text-lg"
                      isLoading={isLoading}
                      disabled={isLoading}
                    >
                      {isLoading ? 'جاري الدخول...' : 'دخول'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setShowLoginForm(false)}
                      variant="ghost"
                      size="lg"
                      disabled={isLoading}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
          </Dialog>
        </div>
      </div>
    </AnimatedBackground>
  )
}

