'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { adminService } from '@/lib/supabase'
import Button from '@/components/Button'
import Card from '@/components/Card'
import toast from 'react-hot-toast'
import { ArrowRight, Save } from 'lucide-react'

export default function CreateStory() {
  const router = useRouter()
  const params = useParams()
  const { userRole, hydrated } = useAppStore()
  const gradeId = params.id as string

  const [story, setStory] = useState({
    title_arabic: '',
    content_arabic: '',
    difficulty: 'easy' as 'easy' | 'medium' | 'hard',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'admin') {
      router.push('/')
      return
    }
  }, [hydrated, userRole, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!story.title_arabic.trim() || !story.content_arabic.trim()) {
      toast.error('الرجاء إكمال جميع الحقول')
      return
    }

    try {
      setIsSaving(true)
      await adminService.createStory({
        title_arabic: story.title_arabic,
        content_arabic: story.content_arabic,
        difficulty: story.difficulty,
        grade_level: parseInt(gradeId, 10),
      })
      toast.success('تم إنشاء القصة بنجاح! ')
      router.push(`/admin/grades/${gradeId}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل إنشاء القصة'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-container min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-ink">إضافة قصة جديدة</h1>
          <Button
            onClick={() => router.push(`/admin/grades/${gradeId}`)}
            variant="ghost"
            size="md"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            العودة
          </Button>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="bg-primary-50 border border-primary-200/30 rounded-lg p-4">
              <p className="text-primary-700 text-sm">هذه القصة ستكون للصف {gradeId}</p>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-2">عنوان القصة</label>
              <input
                type="text"
                value={story.title_arabic}
                onChange={(e) => setStory({ ...story, title_arabic: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-2">محتوى القصة</label>
              <textarea
                value={story.content_arabic}
                onChange={(e) => setStory({ ...story, content_arabic: e.target.value })}
                rows={15}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold resize-none font-arabic"
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-2">مستوى الصعوبة</label>
              <select
                value={story.difficulty}
                onChange={(e) =>
                  setStory({ ...story, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })
                }
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                disabled={isSaving}
              >
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
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
                {isSaving ? 'جاري الحفظ...' : 'إنشاء القصة'}
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
