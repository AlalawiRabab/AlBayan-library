'use client'

import React, { useState, useEffect } from 'react'
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
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Save,
  X,
  Calendar,
  Eye
} from 'lucide-react'

interface FormTemplate {
  id: string
  story_id: string
  story_title: string
  title_arabic: string
  description_arabic: string
  questions: any[]
  is_active: boolean
  created_at: string
}

export default function TeacherFormsPage() {
  const router = useRouter()
  const { user, isAuthenticated, userRole, hydrated } = useAppStore()
  const [forms, setForms] = useState<FormTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null)
  const [viewingForm, setViewingForm] = useState<FormTemplate | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated || userRole !== 'teacher') {
      router.replace('/')
      return
    }

    loadForms()
  }, [hydrated, isAuthenticated, userRole, router])

  const loadForms = async () => {
    try {
      setIsLoading(true)
      
      const teacherData = user as any
      const teacherAccessCode = teacherData?.access_code

      if (!teacherAccessCode) {
        toast.error('رمز المعلمة غير متاح')
        return
      }
      
      // Get teacher ID first
      const { data: teacherInfo } = await supabase
        .from('teachers')
        .select('id')
        .eq('access_code', teacherAccessCode)
        .single()

      if (!teacherInfo) {
        toast.error('Teacher not found')
        return
      }

      // Get forms using RPC function
      const { data: formsData, error } = await supabase.rpc('teacher_get_forms', {
        teacher_access_code: teacherAccessCode
      })

      if (error) {
        console.error('Error fetching forms:', error)
        throw error
      }

      console.log('All forms data (count):', formsData?.length || 0)

      const formattedForms = (formsData || []).map((form: any) => ({
        id: form.id,
        story_id: form.story_id,
        story_title: form.story_title,
        title_arabic: form.title_arabic,
        description_arabic: form.description_arabic,
        questions: form.questions,
        is_active: form.is_active,
        created_at: form.created_at
      }))

      setForms(formattedForms)
    } catch (error) {
      console.error('Error loading forms:', error)
      toast.error('فشل تحميل النماذج')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (form: FormTemplate) => {
    if (showEditForm && editingForm && editingForm.id !== form.id) {
      setShowEditForm(false)
      setTimeout(() => {
        setEditingForm(form)
        setShowEditForm(true)
      }, 300)
    } else if (editingForm?.id === form.id) {
      setShowEditForm(false)
      setEditingForm(null)
    } else {
      setEditingForm(form)
      setShowEditForm(true)
    }
  }

  const handleDelete = async (formId: string, formTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف النموذج "${formTitle}"؟`)) {
      return
    }

    try {
      const teacherAccessCode = (user as any)?.access_code

      if (!teacherAccessCode) {
        toast.error('رمز المعلمة غير متاح')
        return
      }

      const { error } = await supabase.rpc('teacher_delete_form', {
        form_id_param: formId,
        teacher_access_code: teacherAccessCode
      })

      if (error) throw error

      toast.success('تم حذف النموذج بنجاح!')
      loadForms()
    } catch (error: any) {
      console.error('Error deleting form:', error)
      toast.error('فشل حذف النموذج')
    }
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="page-container min-h-screen"
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8"
          >
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-ink mb-2 flex items-center gap-3">
                <FileText className="w-6 h-6 md:w-10 md:h-10 text-primary" />
                نماذجي
              </h1>
              <p className="text-slate-700 text-sm md:text-base">إدارة النماذج التي قمت بإنشائها</p>
            </div>
            <div className="flex gap-2 md:gap-3 w-full md:w-auto">
              <Button
                onClick={() => router.push('/teacher/forms/create')}
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                size="sm"
                className="flex-1 md:flex-none"
              >
                <span className="hidden md:inline">نموذج جديد</span>
                <span className="md:hidden">جديد</span>
              </Button>
              <Button
                onClick={() => router.push('/teacher')}
                variant="ghost"
                size="sm"
                className="flex-1 md:flex-none"
              >
                العودة
              </Button>
            </div>
          </motion.div>

          {/* Edit Form */}
          {showEditForm && editingForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <Card>
                <div className="flex justify-between items-center mb-4 md:mb-6">
                  <h3 className="text-lg md:text-2xl font-bold text-ink">تعديل النموذج</h3>
                  <Button
                    onClick={() => {
                      setShowEditForm(false)
                      setEditingForm(null)
                    }}
                    variant="ghost"
                    size="sm"
                    icon={<X className="w-4 h-4" />}
                    aria-label="إلغاء التعديل"
                  >
                    <span className="hidden sm:inline">إلغاء</span>
                  </Button>
                </div>

                <EditFormTemplate
                  form={editingForm}
                  onSuccess={() => {
                    setShowEditForm(false)
                    setEditingForm(null)
                    loadForms()
                  }}
                />
              </Card>
            </motion.div>
          )}

          {/* View Form Modal */}
          {viewingForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="dialog-backdrop"
              onClick={() => setViewingForm(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="bg-white   p-6 border-b border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-ink mb-1">{viewingForm.title_arabic}</h2>
                      <p className="text-slate-600 text-sm mb-2">{viewingForm.story_title}</p>
                      <p className="text-slate-500 text-xs">{viewingForm.description_arabic}</p>
                    </div>
                    <Button
                      onClick={() => setViewingForm(null)}
                      variant="ghost"
                      size="sm"
                      icon={<X className="w-4 h-4" />}
                      aria-label="إغلاق النافذة"
                    >
                      إغلاق
                    </Button>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    {viewingForm.questions.map((question: any, index: number) => (
                      <div key={question.id || index} className="bg-white p-4 rounded-lg border border-slate-200">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary text-ink rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-ink font-semibold mb-2">{question.text_arabic}</p>
                            <div className="flex items-center gap-3 text-sm">
                              <span className={`px-2 py-1 rounded text-xs ${
                                question.type === 'multiple_choice' ? 'bg-primary-50 text-primary-700' :
                                question.type === 'short_answer' ? 'bg-emerald-50 text-emerald-700' :
                                'bg-secondary-50 text-secondary-700'
                              }`}>
                                {question.type === 'multiple_choice' ? 'اختيار من متعدد' :
                                 question.type === 'short_answer' ? 'إجابة قصيرة' : 'إجابة طويلة'}
                              </span>
                              {question.required && (
                                <span className="text-rose-700 text-xs">مطلوب *</span>
                              )}
                            </div>
                            {question.options && question.options.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {question.options.map((option: string, optIndex: number) => (
                                  <div key={optIndex} className="text-sm text-slate-600 bg-white p-2 rounded">
                                    {String.fromCharCode(65 + optIndex)}. {option}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Forms List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {isLoading ? (
              <Card>
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-slate-700">جاري التحميل...</p>
                </div>
              </Card>
            ) : forms.length === 0 ? (
              <Card>
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-ink mb-2">لا توجد نماذج حتى الآن</h3>
                  <p className="text-slate-700 mb-6">ابدأ بإنشاء نموذج جديد!</p>
                  <Button
                    onClick={() => router.push('/teacher/forms/create')}
                    variant="primary"
                    icon={<Plus className="w-5 h-5" />}
                  >
                    إنشاء نموذج جديد
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {forms.map((form, index) => (
                  <motion.div
                    key={form.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="flex h-full flex-col transition-shadow hover:shadow-lg">
                      {/* Form Header */}
                      <div className="bg-white   p-3 md:p-4 rounded-t-lg -m-6 mb-4">
                        <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-primary mb-2" />
                        <h3 className="text-base md:text-xl font-bold text-ink mb-1 line-clamp-2">{form.title_arabic}</h3>
                        <p className="text-xs md:text-sm text-slate-600 truncate">{form.story_title}</p>
                      </div>

                      {/* Form Info */}
                      <div className="flex-1 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-600 text-xs md:text-sm">عدد الأسئلة</span>
                          <span className="text-primary font-bold text-base md:text-lg">{form.questions?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500">
                          <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                          <span>{new Date(form.created_at).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t border-slate-200">
                        <Button
                          onClick={() => setViewingForm(form)}
                          variant="success"
                          size="sm"
                          icon={<Eye className="w-3 h-3 md:w-4 md:h-4" />}
                          className="flex-1 text-xs md:text-sm"
                          aria-label={`عرض نموذج ${form.title_arabic}`}
                        >
                          <span className="hidden sm:inline">عرض</span>
                        </Button>
                        <Button
                          onClick={() => handleEdit(form)}
                          variant="primary"
                          size="sm"
                          icon={<Edit className="w-3 h-3 md:w-4 md:h-4" />}
                          className="flex-1 text-xs md:text-sm"
                        >
                          {editingForm?.id === form.id && showEditForm ? 'إغلاق' : 'تعديل'}
                        </Button>
                        <Button
                          onClick={() => handleDelete(form.id, form.title_arabic)}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-3 h-3 md:w-4 md:h-4" />}
                          className="text-xs md:text-sm"
                          aria-label={`حذف نموذج ${form.title_arabic}`}
                        >
                          <span className="hidden sm:inline">حذف</span>
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </AnimatedBackground>
  )
}

// Edit Form Component
function EditFormTemplate({ form, onSuccess }: { form: FormTemplate; onSuccess: () => void }) {
  const { user } = useAppStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState(form.title_arabic)
  const [description, setDescription] = useState(form.description_arabic)
  const [questions, setQuestions] = useState(form.questions || [])
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)

  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      text_arabic: '',
      type: 'short_answer',
      required: true,
      options: []
    }
    setQuestions([...questions, newQuestion])
    setEditingQuestionIndex(questions.length)
  }

  const handleUpdateQuestion = (index: number, updates: any) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], ...updates }
    setQuestions(newQuestions)
    setEditingQuestionIndex(null)
  }

  const handleDeleteQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index)
    setQuestions(newQuestions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const teacherAccessCode = (user as any)?.access_code

      if (!teacherAccessCode) {
        toast.error('رمز المعلمة غير متاح')
        setIsSubmitting(false)
        return
      }

      const formattedQuestions = questions.map((question: any) => {
        const baseQuestion: any = {
          id: question.id,
          text_arabic: question.text_arabic,
          type: question.type,
          required: question.required,
        }

        if (question.type === 'multiple_choice') {
          baseQuestion.options = (question.options || [])
            .map((option: string) => String(option ?? '').trim())
            .filter((option: string) => option.length > 0)
          const trimmedCorrectAnswer = question.correct_answer ? String(question.correct_answer).trim() : null
          baseQuestion.correct_answer = trimmedCorrectAnswer && baseQuestion.options.includes(trimmedCorrectAnswer)
            ? trimmedCorrectAnswer
            : null
        }

        return baseQuestion
      })

      const { error } = await supabase.rpc('teacher_update_form', {
        form_id_param: form.id,
        form_title: title,
        form_description: description,
        form_questions: formattedQuestions,
        teacher_access_code: teacherAccessCode
      })

      if (error) throw error

      toast.success('تم تعديل النموذج بنجاح! ')
      onSuccess()
    } catch (error: any) {
      console.error('Error updating form:', error)
      toast.error('فشل تعديل النموذج')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title and Description */}
      <div className="space-y-4">
        <div>
          <label className="block text-slate-600 font-semibold mb-2">عنوان النموذج</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold"
            required
          />
        </div>

        <div>
          <label className="block text-slate-600 font-semibold mb-2">الوصف</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink font-semibold resize-none"
            required
          />
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold text-ink">الأسئلة</h4>
          <Button
            type="button"
            onClick={handleAddQuestion}
            variant="primary"
            size="sm"
          >
            إضافة سؤال
          </Button>
        </div>

        {questions.map((question, index) => (
          <div key={index} className="bg-white p-4 rounded-lg border border-slate-200">
            {editingQuestionIndex === index ? (
              <EditQuestionForm
                question={question}
                onSave={(updates) => handleUpdateQuestion(index, updates)}
                onCancel={() => setEditingQuestionIndex(null)}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-ink font-semibold">{question.text_arabic}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      question.type === 'multiple_choice' ? 'bg-primary-50 text-primary-700' :
                      question.type === 'short_answer' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-secondary-50 text-secondary-700'
                    }`}>
                      {question.type === 'multiple_choice' ? 'اختيار' :
                       question.type === 'short_answer' ? 'قصيرة' : 'طويلة'}
                    </span>
                    {question.required && <span className="text-rose-700 text-xs">مطلوب *</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setEditingQuestionIndex(index)}
                    variant="ghost"
                    size="sm"
                    icon={<Edit className="w-4 h-4" />}
                  >
                    تعديل
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleDeleteQuestion(index)}
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="flex-1"
          isLoading={isSubmitting}
          icon={<Save className="w-5 h-5" />}
        >
          حفظ التعديلات
        </Button>
      </div>
    </form>
  )
}

// Edit Question Form Component
function EditQuestionForm({ question, onSave, onCancel }: { 
  question: any; 
  onSave: (updates: any) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question.text_arabic)
  const [type, setType] = useState(question.type)
  const [required, setRequired] = useState(question.required)
  const [options, setOptions] = useState(question.options || [])
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      text_arabic: text,
      type,
      required,
      options: type === 'multiple_choice' ? options : [],
      correct_answer: type === 'multiple_choice' ? correctAnswer : undefined
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="نص السؤال"
        className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-ink text-sm"
        required
      />
      
      <div className="grid grid-cols-2 gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded bg-white text-ink text-sm"
        >
          <option value="short_answer">إجابة قصيرة</option>
          <option value="long_answer">إجابة طويلة</option>
          <option value="multiple_choice">اختيار من متعدد</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4"
          />
          مطلوب
        </label>
      </div>

      {type === 'multiple_choice' && (
        <div className="space-y-2">
          <label className="text-sm text-slate-600">الخيارات:</label>
          {options.map((option: string, index: number) => (
            <input
              key={index}
              type="text"
              value={option}
              onChange={(e) => {
                const newOptions = [...options]
                newOptions[index] = e.target.value
                setOptions(newOptions)
              }}
              placeholder={`خيار ${index + 1}`}
              className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-ink text-sm"
            />
          ))}
          <Button
            type="button"
            onClick={() => setOptions([...options, ''])}
            variant="ghost"
            size="sm"
          >
            + إضافة خيار
          </Button>
        </div>
      )}

      {type === 'multiple_choice' && options.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-slate-600">الإجابة الصحيحة:</label>
          <select
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-ink text-sm"
          >
            <option value="">اختر الإجابة الصحيحة</option>
            {options.map((option: string, idx: number) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm">
          حفظ
        </Button>
        <Button type="button" onClick={onCancel} variant="ghost" size="sm">
          إلغاء
        </Button>
      </div>
    </form>
  )
}

