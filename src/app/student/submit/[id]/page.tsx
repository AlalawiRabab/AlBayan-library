'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import LoadingState from '@/components/LoadingState'
import StoryQuestions from '@/components/student/StoryQuestions'
import { useAppStore } from '@/lib/store'
import { formsService } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { AlertCircle } from 'lucide-react'

interface Question {
  id: string
  type: 'short_answer' | 'long_answer' | 'multiple_choice'
  required: boolean
  text_arabic: string
  options?: string[]
}

interface FormTemplate {
  id: string
  story_id: string
  title_arabic: string
  description_arabic: string
  questions: Question[]
  is_active: boolean
}

export default function StoryForm() {
  const router = useRouter()
  const params = useParams()
  const { user, isAuthenticated, hydrated } = useAppStore()
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const storyId = params.id as string

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated || !user) {
      router.push('/')
      return
    }

    loadFormTemplate()
  }, [hydrated, isAuthenticated, user, storyId, router])

  const loadFormTemplate = async () => {
    try {
      setIsLoading(true)
      console.log('Loading form template for story:', storyId)
      
      const studentData = user as any
      const studentAccessCode = studentData.access_code
      
      console.log('Student access code:', studentAccessCode)
      
      const formData = await formsService.getStudentFormTemplate(studentAccessCode, storyId)
      
      if (!formData) {
        console.log('No form template found for this story')
        toast.error('لا يوجد نموذج أسئلة لهذه القصة')
        router.push('/student')
        return
      }

      console.log('Loaded form template:', formData)
      setFormTemplate(formData)
      
    } catch (error) {
      console.error('Failed to load form template:', error)
      toast.error('حدث خطأ في تحميل نموذج الأسئلة')
      router.push('/student')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <AnimatedBackground>
        <div className="min-h-screen" dir="rtl"><LoadingState label="جاري تحميل الأسئلة..." /></div>
      </AnimatedBackground>
    )
  }

  if (!formTemplate) {
    return (
      <AnimatedBackground>
        <div className="w-full h-screen flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertCircle className="h-8 w-8" aria-hidden="true" /></div>
            <p className="text-2xl font-bold text-ink">لا يوجد نموذج أسئلة لهذه القصة</p>
            <Button onClick={() => router.push('/student')} className="mt-4">
              العودة للصفحة الرئيسية
            </Button>
          </div>
        </div>
      </AnimatedBackground>
    )
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="page-container min-h-screen pb-12" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <StoryQuestions storyId={storyId} showBack onSubmitted={() => setTimeout(() => router.push('/student'), 1500)} />
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
