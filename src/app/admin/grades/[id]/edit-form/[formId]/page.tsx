'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import Button from '@/components/Button'
import Card from '@/components/Card'
import toast from 'react-hot-toast'
import { ArrowRight, Save } from 'lucide-react'

interface Question {
  id: string
  text_arabic: string
  type: string
  required: boolean
  options?: string[]
  correct_answer?: string
}

export default function EditForm() {
  const router = useRouter()
  const params = useParams()
  const { userRole, hydrated } = useAppStore()
  const gradeId = params.id as string
  const formId = params.formId as string
  
  const [form, setForm] = useState({
    title_arabic: '',
    description_arabic: ''
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'admin') {
      router.push('/')
      return
    }
    loadForm()
  }, [hydrated, userRole, router, formId])

  const loadForm = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase.rpc('admin_get_grade_forms', {
        grade_num: parseInt(gradeId)
      })

      if (error) throw error

      const currentForm = (data || []).find((f: any) => f.id === formId)
      if (currentForm) {
        setForm({
          title_arabic: currentForm.title_arabic,
          description_arabic: currentForm.description_arabic || ''
        })
      } else {
        toast.error('النموذج غير موجود')
        router.push(`/admin/grades/${gradeId}`)
      }
    } catch (error) {
      console.error('Error loading form:', error)
      toast.error('فشل تحميل النموذج')
      router.push(`/admin/grades/${gradeId}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title_arabic.trim()) {
      toast.error('الرجاء إدخال عنوان النموذج')
      return
    }

    try {
      setIsSaving(true)

      const { error } = await supabase
        .from('form_templates')
        .update({
          title_arabic: form.title_arabic,
          description_arabic: form.description_arabic,
          updated_at: new Date().toISOString()
        })
        .eq('id', formId)

      if (error) throw error

      toast.success('تم تحديث النموذج بنجاح! ')
      router.push(`/admin/grades/${gradeId}`)
    } catch (error) {
      console.error('Error updating form:', error)
      toast.error('فشل تحديث النموذج')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-slate-600 mt-4">جاري تحميل النموذج...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-ink">تعديل النموذج</h1>
          <Button
            onClick={() => router.push(`/admin/grades/${gradeId}`)}
            variant="ghost"
            size="md"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            العودة
          </Button>
        </div>

        {/* Form */}
        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-slate-600 font-semibold mb-2">
                عنوان النموذج
              </label>
              <input
                type="text"
                value={form.title_arabic}
                onChange={(e) => setForm({ ...form, title_arabic: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-2">
                وصف النموذج
              </label>
              <textarea
                value={form.description_arabic}
                onChange={(e) => setForm({ ...form, description_arabic: e.target.value })}
                rows={5}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold resize-none"
                disabled={isSaving}
              />
            </div>

            <div className="bg-white p-4 rounded-lg">
              <p className="text-slate-600 text-sm">
                لتعديل الأسئلة، يرجى استخدام واجهة المعلم المتخصصة
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={<Save className="w-5 h-5" />}
                isLoading={isSaving}
                disabled={isSaving}
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </Button>
              <Button
                type="button"
                onClick={() => router.push(`/admin/grades/${gradeId}`)}
                variant="ghost"
                size="lg"
                disabled={isSaving}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

