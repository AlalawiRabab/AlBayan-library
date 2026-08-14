'use client'

import React, { useState } from 'react'

export const dynamic = 'force-dynamic'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { 
  FileText, 
  Save, 
  ArrowRight,
  Plus, 
  Trash2, 
  Eye,
  BookOpen,
  CheckCircle,
  Circle,
  Type,
  List,
  Hash
} from 'lucide-react'

interface Question {
  id: string
  text_arabic: string
  type: 'short_answer' | 'long_answer' | 'multiple_choice'
  required: boolean
  options?: string[]
  correct_answer?: string
}

export default function CreateForm() {
  const router = useRouter()
  const { user, userRole, hydrated } = useAppStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Get teacher's assigned grade dynamically
  const teacherData = user as any
  const assignedGrade = teacherData?.assigned_grade || 3
  
  const [form, setForm] = useState({
    story_id: '',
    title_arabic: '',
    description_arabic: '',
    grade_level: assignedGrade,
  })
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: '1',
      text_arabic: 'ما هي الفكرة الرئيسية للقصة؟',
      type: 'short_answer',
      required: true,
    },
  ])
  const [stories, setStories] = useState<any[]>([])

  React.useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'teacher') {
      router.replace('/')
      return
    }
    loadStories()
  }, [hydrated, userRole, router])

  const loadStories = async () => {
    try {
      const teacherData = user as any

      if (!teacherData?.access_code) {
        toast.error('رمز المعلمة غير متاح')
        return
      }

      // Use the new teacher_get_stories function
      const { data, error } = await supabase.rpc('teacher_get_stories', {
        teacher_access_code: teacherData.access_code
      })

      if (error) {
        console.error('Error loading stories:', error)
        toast.error(`فشل تحميل القصص: ${error.message}`)
        return
      }

      setStories(data || [])
    } catch (error) {
      console.error('Error loading stories:', error)
      toast.error('فشل تحميل القصص')
    }
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      text_arabic: '',
      type: 'short_answer',
      required: true,
    }
    setQuestions([...questions, newQuestion])
  }

  const removeQuestion = (id: string) => {
    if (questions.length > 1) {
      setQuestions(questions.filter(q => q.id !== id))
    }
  }

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ))
  }

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const options = q.options || []
        return { ...q, options: [...options, ''] }
      }
      return q
    }))
  }

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        const newOptions = [...q.options]
        newOptions[optionIndex] = value
        return { ...q, options: newOptions }
      }
      return q
    }))
  }

  const setCorrectAnswer = (questionId: string, correctAnswer: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, correct_answer: correctAnswer } : q
    ))
  }

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        const newOptions = q.options.filter((_, index) => index !== optionIndex)
        return { ...q, options: newOptions }
      }
      return q
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title_arabic.trim()) {
      toast.error('الرجاء إدخال عنوان النموذج')
      return
    }

    if (!form.story_id) {
      toast.error('الرجاء اختيار قصة')
      return
    }

    const validQuestions = questions.filter(q => q.text_arabic.trim())
    if (validQuestions.length === 0) {
      toast.error('الرجاء إضافة سؤال واحد على الأقل')
      return
    }

    try {
      setIsSubmitting(true)

      const teacherData = user as any

      const formQuestions = validQuestions.map(q => ({
        id: q.id,
        text_arabic: q.text_arabic,
        type: q.type,
        required: q.required,
        options: q.type === 'multiple_choice' ? q.options : undefined,
        correct_answer: q.type === 'multiple_choice' ? q.correct_answer : undefined,
      }))

      // Use the new teacher_create_form function
      const { data, error } = await supabase.rpc('teacher_create_form', {
        form_story_id: form.story_id,
        form_title: form.title_arabic,
        form_description: form.description_arabic,
        form_questions: formQuestions,
        teacher_access_code: teacherData.access_code
      })

      if (error) {
        console.error('Error creating form:', error)
        toast.error(`فشل إنشاء النموذج: ${error.message}`)
        return
      }

      toast.success('تم إنشاء النموذج بنجاح! ')
      
      setTimeout(() => {
        router.push('/teacher')
      }, 1500)
    } catch (error) {
      console.error('Error creating form:', error)
      toast.error('فشل إنشاء النموذج')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!hydrated) {
    return null
  }

  if (userRole !== 'teacher') {
    return null
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="page-container min-h-screen" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2 flex items-center gap-3">
                <FileText className="w-10 h-10 text-accent-green" />
                إنشاء نموذج تحليل
              </h1>
              <p className="text-slate-600 text-lg font-semibold">
                إنشاء نموذج لتحليل القصص
              </p>
            </div>
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="md"
              icon={<ArrowRight className="w-5 h-5" />}
            >
              العودة
            </Button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Form Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <label className="block text-ink font-bold text-xl mb-3">
                    عنوان النموذج
                  </label>
                  <input
                    type="text"
                    value={form.title_arabic}
                    onChange={(e) =>
                      setForm({ ...form, title_arabic: e.target.value })
                    }
                    placeholder="مثال: تحليل قصة القط الشجاع"
                    className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                    disabled={isSubmitting}
                    required
                  />
                </Card>

                <Card>
                  <label className="block text-ink font-bold text-xl mb-3">
                    القصة المرتبطة
                  </label>
                  <select
                    value={form.story_id}
                    onChange={(e) =>
                      setForm({ ...form, story_id: e.target.value })
                    }
                    className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">اختر قصة...</option>
                    {stories.map((story) => (
                      <option key={story.id} value={story.id}>
                        {story.title_arabic} (الصف {story.grade_level})
                      </option>
                    ))}
                  </select>
                </Card>
              </div>

              {/* Description */}
              <Card>
                <label className="block text-ink font-bold text-xl mb-3">
                  وصف النموذج
                </label>
                <textarea
                  value={form.description_arabic}
                  onChange={(e) =>
                    setForm({ ...form, description_arabic: e.target.value })
                  }
                  placeholder="وصف مختصر للنموذج..."
                  rows={3}
                  className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold resize-none"
                  disabled={isSubmitting}
                />
              </Card>

              {/* Questions */}
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-ink">الأسئلة</h3>
                  <Button
                    type="button"
                    onClick={addQuestion}
                    variant="secondary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    disabled={isSubmitting}
                  >
                    إضافة سؤال
                  </Button>
                </div>

                <div className="space-y-6">
                  {questions.map((question, index) => (
                    <motion.div
                      key={question.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white p-6 rounded-lg border border-slate-200"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-bold text-ink">
                          سؤال {index + 1}
                        </h4>
                        {questions.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeQuestion(question.id)}
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="w-4 h-4" />}
                            disabled={isSubmitting}
                          >
                            حذف
                          </Button>
                        )}
                      </div>

                      {/* Question Text */}
                      <div className="mb-4">
                        <label className="block text-slate-600 font-semibold mb-2">
                          نص السؤال
                        </label>
                        <input
                          type="text"
                          value={question.text_arabic}
                          onChange={(e) =>
                            updateQuestion(question.id, 'text_arabic', e.target.value)
                          }
                          placeholder="اكتب السؤال هنا..."
                          className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Question Type */}
                      <div className="mb-4">
                        <label className="block text-slate-600 font-semibold mb-2">
                          نوع السؤال
                        </label>
                        <div className="flex gap-4">
                          {[
                            { value: 'short_answer', label: 'إجابة قصيرة', icon: Type },
                            { value: 'long_answer', label: 'إجابة طويلة', icon: FileText },
                            { value: 'multiple_choice', label: 'اختيار متعدد', icon: List },
                          ].map(({ value, label, icon: Icon }) => (
                            <label
                              key={value}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                                question.type === value
                                  ? 'bg-primary text-ink'
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`type-${question.id}`}
                                value={value}
                                checked={question.type === value}
                                onChange={(e) =>
                                  updateQuestion(question.id, 'type', e.target.value)
                                }
                                className="sr-only"
                                disabled={isSubmitting}
                              />
                              <Icon className="w-4 h-4" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Multiple Choice Options */}
                      {question.type === 'multiple_choice' && (
                        <div className="mb-4">
                          <label className="block text-slate-600 font-semibold mb-2">
                            خيارات الإجابة
                          </label>
                          <div className="space-y-2">
                            {(question.options || []).map((option, optionIndex) => (
                              <div key={optionIndex} className="flex gap-2">
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) =>
                                    updateOption(question.id, optionIndex, e.target.value)
                                  }
                                  placeholder={`خيار ${optionIndex + 1}`}
                                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-ink"
                                  disabled={isSubmitting}
                                />
                                <Button
                                  type="button"
                                  onClick={() => removeOption(question.id, optionIndex)}
                                  variant="ghost"
                                  size="sm"
                                  icon={<Trash2 className="w-3 h-3" />}
                                  disabled={isSubmitting}
                                />
                              </div>
                            ))}
                            <Button
                              type="button"
                              onClick={() => addOption(question.id)}
                              variant="ghost"
                              size="sm"
                              icon={<Plus className="w-3 h-3" />}
                              disabled={isSubmitting}
                            >
                              إضافة خيار
                            </Button>
                          </div>
                          
                          {/* Correct Answer Selector */}
                          {(question.options || []).length > 0 && (
                            <div className="mt-4">
                              <label className="block text-slate-600 font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-700" />
                                الإجابة الصحيحة
                              </label>
                              <select
                                value={question.correct_answer || ''}
                                onChange={(e) => setCorrectAnswer(question.id, e.target.value)}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
                                disabled={isSubmitting}
                              >
                                <option value="">اختر الإجابة الصحيحة</option>
                                {(question.options || []).map((option, idx) => (
                                  <option key={idx} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Required */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`required-${question.id}`}
                          checked={question.required}
                          onChange={(e) =>
                            updateQuestion(question.id, 'required', e.target.checked)
                          }
                          className="w-4 h-4 text-primary bg-white border-slate-200 rounded focus:ring-primary"
                          disabled={isSubmitting}
                        />
                        <label
                          htmlFor={`required-${question.id}`}
                          className="text-slate-600 font-semibold cursor-pointer"
                        >
                          سؤال إجباري
                        </label>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>

              {/* Preview */}
              {form.title_arabic && questions.some(q => q.text_arabic) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-white  ">
                    <h3 className="text-2xl font-bold text-ink mb-4 flex items-center gap-2">
                      <Eye className="w-6 h-6" />
                      معاينة النموذج
                    </h3>
                    <div className="bg-white p-6 rounded-lg">
                      <h4 className="text-2xl font-bold text-ink mb-4">
                        {form.title_arabic}
                      </h4>
                      {form.description_arabic && (
                        <p className="text-slate-600 mb-6 font-semibold">
                          {form.description_arabic}
                        </p>
                      )}
                      <div className="space-y-4">
                        {questions
                          .filter(q => q.text_arabic)
                          .map((question, index) => (
                            <div key={question.id} className="border-b border-slate-200 pb-4">
                              <h5 className="text-lg font-bold text-ink mb-2">
                                {index + 1}. {question.text_arabic}
                                {question.required && (
                                  <span className="text-accent-red me-2">*</span>
                                )}
                              </h5>
                              {question.type === 'short_answer' && (
                                <input
                                  type="text"
                                  disabled
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-500"
                                  placeholder="إجابة قصيرة..."
                                />
                              )}
                              {question.type === 'long_answer' && (
                                <textarea
                                  disabled
                                  rows={3}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-500 resize-none"
                                  placeholder="إجابة طويلة..."
                                />
                              )}
                              {question.type === 'multiple_choice' && (
                                <div className="space-y-2">
                                  {(question.options || []).map((option, optionIndex) => (
                                    <label
                                      key={optionIndex}
                                      className="flex items-center gap-2 text-slate-600"
                                    >
                                      <input
                                        type="radio"
                                        disabled
                                        className="w-4 h-4"
                                      />
                                      {option || `خيار ${optionIndex + 1}`}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Submit */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  icon={<Save className="w-5 h-5" />}
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'إنشاء النموذج'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
