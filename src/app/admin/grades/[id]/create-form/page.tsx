'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { adminService, supabase } from '@/lib/supabase'
import Button from '@/components/Button'
import Card from '@/components/Card'
import toast from 'react-hot-toast'
import { ArrowRight, Save } from 'lucide-react'

export default function CreateForm() {
  const router = useRouter()
  const params = useParams()
  const { userRole, hydrated } = useAppStore()
  const gradeId = params.id as string
  
  const [form, setForm] = useState({
    title_arabic: '',
    description_arabic: '',
    story_id: ''
  })
  const [stories, setStories] = useState<any[]>([])
  const [isLoadingStories, setIsLoadingStories] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'admin') {
      router.push('/')
      return
    }
    loadStories()
  }, [hydrated, userRole, router])

  const loadStories = async () => {
    try {
      setIsLoadingStories(true)
      const data = await adminService.getGradeStories(parseInt(gradeId, 10))
      setStories(data || [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل تحميل القصص'
      toast.error(message)
    } finally {
      setIsLoadingStories(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title_arabic.trim()) {
      toast.error('الرجاء إدخال عنوان النموذج')
      return
    }

    if (!form.story_id) {
      toast.error('الرجاء اختيار قصة')
      return
    }

    try {
      setIsSaving(true)

      // Find a teacher assigned to this grade to be the author
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('assigned_grade', parseInt(gradeId))
        .eq('is_active', true)
        .limit(1)
        .single()

      let authorId = null
      if (teacherData) {
        authorId = teacherData.id
      }

      const { data, error } = await supabase
        .from('form_templates')
        .insert({
          title_arabic: form.title_arabic,
          description_arabic: form.description_arabic,
          story_id: form.story_id,
          created_by: authorId,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      toast.success('تم إنشاء النموذج بنجاح! ')
      router.push(`/admin/grades/${gradeId}`)
    } catch (error) {
      console.error('Error creating form:', error)
      toast.error('فشل إنشاء النموذج')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-container min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-ink">إضافة نموذج جديد</h1>
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
            <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4">
              <p className="text-secondary text-sm">
                هذا النموذج ستكون للصف {gradeId}
              </p>
              <p className="text-slate-600 text-xs mt-2">
                لإضافة الأسئلة، قم بإنشاء النموذج أولاً ثم استخدم زر التعديل
              </p>
            </div>

            {isLoadingStories ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-slate-600 mt-4">جاري تحميل القصص...</p>
              </div>
            ) : stories.length === 0 ? (
              <div className="bg-amber-50/10 border border-amber-200/30 rounded-lg p-4">
                <p className="text-amber-700">
                  لا توجد قصص لهذا الصف، يرجى إنشاء قصة أولاً
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-slate-600 font-semibold mb-2">
                  القصة المرتبطة
                </label>
                <select
                  value={form.story_id}
                  onChange={(e) => setForm({ ...form, story_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                  required
                  disabled={isSaving}
                >
                  <option value="">اختر قصة</option>
                  {stories.map((story) => (
                    <option key={story.id} value={story.id}>
                      {story.title_arabic}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            <div className="flex gap-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={<Save className="w-5 h-5" />}
                isLoading={isSaving}
                disabled={isSaving || stories.length === 0}
              >
                {isSaving ? 'جاري الحفظ...' : 'إنشاء النموذج'}
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

