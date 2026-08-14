'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { supabase, adminGradingService, gradingService } from '@/lib/supabase'
import { getTrustedStudentRecordingUrl, inferAudioMimeFromUrl } from '@/lib/utils'
import Button from '@/components/Button'
import Card from '@/components/Card'
import toast from 'react-hot-toast'
import { 
  BookOpen, 
  FileText, 
  ArrowRight,
  User,
  Calendar,
  Eye,
  Edit,
  Trash2,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Award,
  Mic,
  Brain,
  Save
} from 'lucide-react'

interface Story {
  id: string
  title_arabic: string
  content_arabic: string
  difficulty: string
  created_at: string
  author_name?: string
}

interface Form {
  id: string
  title_arabic: string
  description_arabic: string
  created_at: string
  story_id: string
  story_title?: string
  author_name?: string
  question_count: number
}

interface Submission {
  submission_id: string
  student_id: string
  student_name: string
  student_access_code: string
  story_title: string
  story_id: string
  form_title: string
  form_id: string
  questions: any[]
  responses: Record<string, string>
  grade?: number
  voice_grade?: number
  feedback?: string
  auto_graded?: number
  auto_feedback?: string
  audio_url?: string
  submitted_at: string
  graded_at?: string
}

export default function GradeDetails() {
  const router = useRouter()
  const params = useParams()
  const { user, userRole, hydrated } = useAppStore()
  const gradeId = params.id as string
  const [stories, setStories] = useState<Story[]>([])
  const [forms, setForms] = useState<Form[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewingStory, setViewingStory] = useState<Story | null>(null)
  const [viewingForm, setViewingForm] = useState<Form | null>(null)
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null)
  const [activeTab, setActiveTab] = useState<'stories' | 'forms' | 'submissions'>('stories')
  const [isGrading, setIsGrading] = useState(false)
  const [editGrade, setEditGrade] = useState('')
  const [editVoiceGrade, setEditVoiceGrade] = useState('')
  const [editFeedback, setEditFeedback] = useState('')

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'admin') {
      router.push('/')
      return
    }
    loadGradeData()
  }, [hydrated, userRole, router, gradeId])

  const loadGradeData = async () => {
    try {
      setIsLoading(true)
      const gradeNum = parseInt(gradeId)

      // Load stories for this grade using RPC
      const { data: storiesData, error: storiesError } = await supabase.rpc('admin_get_grade_stories', {
        grade_num: gradeNum
      })

      console.log('Stories query result:', { data: storiesData, error: storiesError, gradeNum })

      if (!storiesError && storiesData) {
        setStories(storiesData as Story[])
      }

      // Load forms for this grade using RPC
      const { data: formsData, error: formsError } = await supabase.rpc('admin_get_grade_forms', {
        grade_num: gradeNum
      })
      
      console.log('Forms query result:', { data: formsData, error: formsError, count: formsData?.length })

      if (!formsError && formsData) {
        setForms(formsData as Form[])
      }

      // Load submissions for this grade
      try {
        if (!user || !('access_code' in user)) throw new Error('Admin access code is unavailable')
        const submissionsData = await adminGradingService.getGradeSubmissions(gradeNum, (user as any).access_code)
        console.log('Submissions loaded:', submissionsData.length)
        setSubmissions(submissionsData.map((submission: Submission) => ({
          ...submission,
          audio_url: getTrustedStudentRecordingUrl(submission.audio_url)
        })))
      } catch (error) {
        console.error('Error loading submissions:', error)
      }
    } catch (error) {
      console.error('Error loading grade data:', error)
      toast.error('فشل تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteStory = async (storyId: string, storyTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف القصة "${storyTitle}"؟`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)

      if (error) throw error

      toast.success('تم حذف القصة بنجاح!')
      loadGradeData()
    } catch (error) {
      console.error('Error deleting story:', error)
      toast.error('فشل حذف القصة')
    }
  }

  const deleteForm = async (formId: string, formTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف النموذج "${formTitle}"؟`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('form_templates')
        .delete()
        .eq('id', formId)

      if (error) throw error

      toast.success('تم حذف النموذج بنجاح!')
      loadGradeData()
    } catch (error) {
      console.error('Error deleting form:', error)
      toast.error('فشل حذف النموذج')
    }
  }

  const deleteGrade = async () => {
    if (!confirm(`هل أنت متأكد من حذف الصف ${gradeId} بشكل كامل؟\nسيتم حذف جميع القصص والنماذج المرتبطة بهذا الصف.`)) {
      return
    }

    try {
      if (!user || !('access_code' in user)) throw new Error('Admin access code is unavailable')
      const response = await fetch('/api/admin/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAccessCode: (user as any).access_code,
          operation: 'delete',
          gradeId: parseInt(gradeId)
        })
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete grade')

      toast.success('تم حذف الصف بنجاح!')
      router.push('/admin/grades')
    } catch (error) {
      console.error('Error deleting grade:', error)
      toast.error('فشل حذف الصف')
    }
  }

  const handleGradeSubmission = async () => {
    if (!viewingSubmission) return

    const gradeNum = editGrade ? parseInt(editGrade) : undefined
    const voiceGradeNum = editVoiceGrade ? parseInt(editVoiceGrade) : undefined

    if (gradeNum !== undefined && (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100)) {
      toast.error('الرجاء إدخال درجة صحيحة (0-100)')
      return
    }

    if (voiceGradeNum !== undefined && (isNaN(voiceGradeNum) || voiceGradeNum < 0 || voiceGradeNum > 100)) {
      toast.error('الرجاء إدخال درجة صوتية صحيحة (0-100)')
      return
    }

    // At least one grade must be provided
    if (gradeNum === undefined && voiceGradeNum === undefined) {
      toast.error('الرجاء إدخال درجة واحدة على الأقل')
      return
    }

    try {
      setIsGrading(true)
      console.log('Admin grading submission:', viewingSubmission.submission_id)

      // Use the final grade value or keep existing
      const finalGrade = gradeNum !== undefined ? gradeNum : viewingSubmission.grade
      const finalVoiceGrade = voiceGradeNum !== undefined ? voiceGradeNum : viewingSubmission.voice_grade

      await gradingService.gradeSubmission(
        viewingSubmission.submission_id,
        finalGrade ?? 0,
        editFeedback || viewingSubmission.feedback || '',
        finalVoiceGrade
      )

      toast.success('تم تحديث التقييم بنجاح! ')

      // Update local state
      setSubmissions(submissions.map(sub =>
        sub.submission_id === viewingSubmission.submission_id
          ? {
              ...sub,
              grade: finalGrade,
              voice_grade: finalVoiceGrade,
              feedback: editFeedback || sub.feedback,
              graded_at: new Date().toISOString()
            }
          : sub
      ))

      setViewingSubmission(null)
      setEditGrade('')
      setEditVoiceGrade('')
      setEditFeedback('')

      // Refresh submissions
      setTimeout(() => {
        loadGradeData()
      }, 1000)

    } catch (error) {
      console.error('Error grading submission:', error)
      toast.error('فشل تحديث التقييم')
    } finally {
      setIsGrading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-slate-600 mt-4">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-ink mb-2">تفاصيل الصف {gradeId}</h1>
            <p className="text-slate-600 text-sm md:text-base">القصص والنماذج والإجابات الخاصة بهذا الصف</p>
          </div>
          <div className="flex gap-2 md:gap-3">
            <Button
              onClick={() => router.push('/admin/grades')}
              variant="ghost"
              size="sm"
              className="flex-1 md:flex-none"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              العودة
            </Button>
            <Button
              onClick={deleteGrade}
              variant="ghost"
              size="sm"
              className="flex-1 md:flex-none text-rose-700 hover:text-rose-700 hover:bg-rose-50"
              icon={<AlertTriangle className="w-4 h-4" />}
            >
              حذف الصف
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <Button
            onClick={() => setActiveTab('stories')}
            variant={activeTab === 'stories' ? 'primary' : 'ghost'}
            size="md"
            icon={<BookOpen className="w-4 h-4" />}
          >
            القصص ({stories.length})
          </Button>
          <Button
            onClick={() => setActiveTab('forms')}
            variant={activeTab === 'forms' ? 'secondary' : 'ghost'}
            size="md"
            icon={<FileText className="w-4 h-4" />}
          >
            النماذج ({forms.length})
          </Button>
          <Button
            onClick={() => setActiveTab('submissions')}
            variant={activeTab === 'submissions' ? 'ghost' : 'ghost'}
            size="md"
            className={activeTab === 'submissions' ? 'bg-secondary-50 text-secondary-700 hover:bg-secondary-100' : ''}
            icon={<Award className="w-4 h-4" />}
          >
            الإجابات والتقييم ({submissions.length})
          </Button>
        </div>

        {/* Stories Section */}
        {activeTab === 'stories' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 md:gap-3">
                <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-primary flex-shrink-0" />
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-ink">القصص ({stories.length})</h2>
                  <p className="text-slate-600 text-sm md:text-base">جميع القصص المتاحة للصف {gradeId}</p>
                </div>
              </div>
              <Button
                onClick={() => router.push(`/admin/grades/${gradeId}/create-story`)}
                variant="primary"
                size="sm"
                className="w-full md:w-auto"
                icon={<Plus className="w-4 h-4" />}
              >
                إضافة قصة
              </Button>
            </div>

            {stories.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-ink mb-2">لا توجد قصص لهذا الصف</h3>
                <p className="text-slate-600">لم يتم إنشاء قصص بعد</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stories.map((story, index) => (
                  <motion.div
                    key={story.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white p-3 md:p-4 rounded-lg border border-slate-200 hover:border-primary transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-ink mb-2">{story.title_arabic}</h3>
                        <p className="text-slate-600 text-xs md:text-sm mb-3 line-clamp-2">{story.content_arabic}</p>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-500">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            story.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' :
                            story.difficulty === 'medium' ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {story.difficulty === 'easy' ? 'سهل' : story.difficulty === 'medium' ? 'متوسط' : 'صعب'}
                          </span>
                          <span className="flex items-center gap-1 truncate">
                            <User className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span className="truncate">{story.author_name}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span className="hidden md:inline">{new Date(story.created_at).toLocaleDateString('ar-SA')}</span>
                            <span className="md:hidden">{new Date(story.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'numeric' })}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => setViewingStory(story)}
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="w-4 h-4" />}
                        >
                          عرض
                        </Button>
                        <Button
                          onClick={() => router.push(`/admin/grades/${gradeId}/edit-story/${story.id}`)}
                          variant="ghost"
                          size="sm"
                          icon={<Edit className="w-4 h-4" />}
                        >
                          تعديل
                        </Button>
                        <Button
                          onClick={() => deleteStory(story.id, story.title_arabic)}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          حذف
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
        )}

        {/* Forms Section */}
        {activeTab === 'forms' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 md:gap-3">
                <FileText className="w-6 h-6 md:w-8 md:h-8 text-secondary flex-shrink-0" />
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-ink">نماذج الأسئلة ({forms.length})</h2>
                  <p className="text-slate-600 text-sm md:text-base">جميع نماذج الأسئلة للصف {gradeId}</p>
                </div>
              </div>
              <Button
                onClick={() => router.push(`/admin/grades/${gradeId}/create-form`)}
                variant="secondary"
                size="sm"
                className="w-full md:w-auto"
                icon={<Plus className="w-4 h-4" />}
              >
                إضافة نموذج
              </Button>
            </div>

            {forms.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-ink mb-2">لا توجد نماذج لهذا الصف</h3>
                <p className="text-slate-600">لم يتم إنشاء نماذج بعد</p>
              </div>
            ) : (
              <div className="space-y-4">
                {forms.map((form, index) => (
                  <motion.div
                    key={form.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white p-3 md:p-4 rounded-lg border border-slate-200 hover:border-secondary transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-ink mb-2">{form.title_arabic}</h3>
                        <p className="text-slate-600 text-xs md:text-sm mb-3">{form.description_arabic}</p>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-500">
                          <span className="flex items-center gap-1 truncate">
                            <BookOpen className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span className="truncate">{form.story_title}</span>
                          </span>
                          <span className="text-primary font-bold">{form.question_count} سؤال</span>
                          <span className="flex items-center gap-1 truncate">
                            <User className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span className="truncate">{form.author_name}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span className="hidden md:inline">{new Date(form.created_at).toLocaleDateString('ar-SA')}</span>
                            <span className="md:hidden">{new Date(form.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'numeric' })}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => setViewingForm(form)}
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="w-4 h-4" />}
                        >
                          عرض
                        </Button>
                        <Button
                          onClick={() => router.push(`/admin/grades/${gradeId}/edit-form/${form.id}`)}
                          variant="ghost"
                          size="sm"
                          icon={<Edit className="w-4 h-4" />}
                        >
                          تعديل
                        </Button>
                        <Button
                          onClick={() => deleteForm(form.id, form.title_arabic)}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          حذف
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
        )}

        {/* Submissions Section */}
        {activeTab === 'submissions' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 mb-6">
              <Award className="w-6 h-6 md:w-8 md:h-8 text-secondary-700 flex-shrink-0" />
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-ink">إجابات الطلاب والتقييم ({submissions.length})</h2>
                <p className="text-slate-600 text-sm md:text-base">عرض جميع إجابات الطلاب مع التقييم الآلي وتقييم المعلم</p>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <Award className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-ink mb-2">لا توجد إجابات</h3>
                <p className="text-slate-600">لم يتم إرسال أي إجابات لهذا الصف بعد</p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission, index) => {
                  const finalGrade = submission.grade !== null && submission.grade !== undefined && 
                                    submission.voice_grade !== null && submission.voice_grade !== undefined
                    ? Math.round((submission.grade + submission.voice_grade) / 2)
                    : submission.grade ?? submission.voice_grade ?? null

                  return (
                    <motion.div
                      key={submission.submission_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white p-3 md:p-4 rounded-lg border border-slate-200 hover:border-secondary-200 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base md:text-lg font-bold text-ink mb-2 flex items-center gap-2">
                            <User className="w-4 h-4 text-secondary-700" />
                            {submission.student_name}
                          </h3>
                          <div className="space-y-1 text-xs md:text-sm text-slate-500">
                            <p className="flex items-center gap-1 truncate">
                              <BookOpen className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span className="truncate">القصة: {submission.story_title}</span>
                            </p>
                            <p className="flex items-center gap-1 truncate">
                              <FileText className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span className="truncate">النموذج: {submission.form_title}</span>
                            </p>
                            <p className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span>{new Date(submission.submitted_at).toLocaleDateString('ar-SA')}</span>
                            </p>
                          </div>

                          {/* Grading Status */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {/* AI Grading */}
                            {submission.auto_graded !== null && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-200/30">
                                <Brain className="w-3 h-3" />
                                <span className="text-xs font-bold">AI: {submission.auto_graded}/100</span>
                              </div>
                            )}

                            {/* Teacher Grading */}
                            {submission.grade !== null && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/30">
                                <CheckCircle className="w-3 h-3" />
                                <span className="text-xs font-bold">المعلم: {submission.grade}/100</span>
                              </div>
                            )}

                            {/* Voice Grading */}
                            {submission.voice_grade !== null && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary-50 text-secondary-700 border border-secondary-200/30">
                                <Mic className="w-3 h-3" />
                                <span className="text-xs font-bold">الصوت: {submission.voice_grade}/100</span>
                              </div>
                            )}

                            {/* Voice Recording Available */}
                            {submission.audio_url && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50/20 text-orange-300 border border-orange-500/30">
                                <Mic className="w-3 h-3" />
                                <span className="text-xs">تسجيل صوتي متاح</span>
                              </div>
                            )}

                            {/* Ungraded */}
                            {submission.grade === null && submission.voice_grade === null && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/30">
                                <Clock className="w-3 h-3" />
                                <span className="text-xs">في انتظار التقييم</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto sm:justify-end mt-3">
                          {finalGrade !== null && (
                            <div className={`text-center px-3 py-2 rounded-lg ${
                              finalGrade >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/30' :
                              finalGrade >= 70 ? 'bg-primary-50 text-primary-700 border border-primary-200/30' :
                              finalGrade >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200/30' :
                              'bg-rose-50 text-rose-700 border border-rose-200/30'
                            }`}>
                              <div className="text-xs">الدرجة النهائية</div>
                              <div className="text-lg md:text-xl font-bold">{finalGrade}/100</div>
                            </div>
                          )}
                          <Button
                            onClick={() => {
                              setViewingSubmission(submission)
                              setEditGrade(submission.grade?.toString() || '')
                              setEditVoiceGrade(submission.voice_grade?.toString() || '')
                              setEditFeedback(submission.feedback || '')
                            }}
                            variant="primary"
                            size="md"
                            icon={<Edit className="w-4 h-4 md:w-5 md:h-5" />}
                            className="bg-primary-50 hover:bg-primary-100 w-full sm:w-auto text-sm md:text-base font-bold shadow-lg"
                          >
                            عرض وتعديل التقييم
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </Card>
        </motion.div>
        )}

        {/* View Story Modal */}
        {viewingStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="dialog-backdrop"
            onClick={() => setViewingStory(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-white   p-6 border-b border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-ink mb-2">{viewingStory.title_arabic}</h2>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-3 py-1 rounded-full font-semibold ${
                        viewingStory.difficulty === 'easy' ? 'bg-accent-green text-ink' :
                        viewingStory.difficulty === 'medium' ? 'bg-secondary text-ink' : 'bg-accent-red text-ink'
                      }`}>
                        {viewingStory.difficulty === 'easy' ? 'سهل' : viewingStory.difficulty === 'medium' ? 'متوسط' : 'صعب'}
                      </span>
                      <span className="text-slate-600">الصف {gradeId}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setViewingStory(null)}
                    variant="ghost"
                    size="sm"
                    icon={<X className="w-4 h-4" />}
                  >
                    إغلاق
                  </Button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="prose prose-invert max-w-none">
                  <div className="text-ink text-lg leading-lax font-arabic whitespace-pre-wrap">
                    {viewingStory.content_arabic}
                  </div>
                </div>
              </div>
            </motion.div>
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
              className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-white   p-6 border-b border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-ink mb-2">{viewingForm.title_arabic}</h2>
                    <p className="text-slate-600">{viewingForm.description_arabic}</p>
                    <div className="flex items-center gap-3 text-sm mt-2">
                      <span className="text-primary">القصة: {viewingForm.story_title}</span>
                      <span className="text-secondary">{viewingForm.question_count} سؤال</span>
                      <span className="text-slate-500">بواسطة: {viewingForm.author_name}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setViewingForm(null)}
                    variant="ghost"
                    size="sm"
                    icon={<X className="w-4 h-4" />}
                  >
                    إغلاق
                  </Button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="text-ink">
                  <p className="text-lg mb-4">النموذج مكون من {viewingForm.question_count} سؤال</p>
                  <p className="text-slate-600">لمعرض الأسئلة، يرجى استخدام زر التعديل</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* View Submission Modal */}
        {viewingSubmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="dialog-backdrop"
            onClick={() => setViewingSubmission(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-white   p-4 md:p-6 border-b border-slate-200">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-2xl font-bold text-ink mb-1 md:mb-2">تفاصيل الإجابة</h2>
                    <p className="text-slate-600 text-sm md:text-base truncate">الطالب: {viewingSubmission.student_name}</p>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm mt-2">
                      <span className="text-primary truncate">القصة: {viewingSubmission.story_title}</span>
                      <span className="text-secondary truncate">النموذج: {viewingSubmission.form_title}</span>
                      <span className="text-slate-500">{new Date(viewingSubmission.submitted_at).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setViewingSubmission(null)
                      setEditGrade('')
                      setEditVoiceGrade('')
                      setEditFeedback('')
                    }}
                    variant="ghost"
                    size="sm"
                    icon={<X className="w-4 h-4" />}
                    className="flex-shrink-0"
                    aria-label="إغلاق النافذة"
                  >
                    <span className="hidden sm:inline">إغلاق</span>
                  </Button>
                </div>
              </div>

              <div className="p-4 md:p-6 overflow-y-auto flex-1">
                <div className="space-y-6">
                  {/* Edit Grades Section - Prominently at the top */}
                  <div className="bg-white   p-3 md:p-6 rounded-xl border-2 border-primary-200/50 shadow-lg">
                    <h3 className="text-ink font-bold mb-3 md:mb-4 text-base md:text-xl flex items-center gap-2">
                      <Edit className="w-5 h-5 md:w-6 md:h-6 text-primary-700 flex-shrink-0" />
                      تعديل التقييم
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Grade Input */}
                      <div>
                        <label className="block text-ink font-semibold mb-2 text-sm md:text-base">
                          درجة النموذج (0-100)
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editGrade}
                          onChange={(e) => setEditGrade(e.target.value)}
                          min="0"
                          max="100"
                          className="w-full px-3 md:px-4 py-3 md:py-3 border-2 border-primary-200/30 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/30 bg-white text-ink font-semibold text-base md:text-lg"
                          placeholder="أدخل الدرجة (0-100)"
                          disabled={isGrading}
                        />
                      </div>

                      {/* Voice Grade Input (if audio exists) */}
                      {viewingSubmission.audio_url && (
                        <div>
                          <label className="block text-ink font-semibold mb-2 text-sm md:text-base">
                            درجة القراءة الصوتية (0-100)
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={editVoiceGrade}
                            onChange={(e) => setEditVoiceGrade(e.target.value)}
                            min="0"
                            max="100"
                            className="w-full px-3 md:px-4 py-3 md:py-3 border-2 border-secondary-200/30 rounded-lg focus:outline-none focus:ring-4 focus:ring-secondary/30 bg-white text-ink font-semibold text-base md:text-lg"
                            placeholder="أدخل درجة القراءة (0-100)"
                            disabled={isGrading}
                          />
                        </div>
                      )}

                      {/* Feedback Input */}
                      <div>
                        <label className="block text-ink font-semibold mb-2 text-sm md:text-base">
                          التعليق (اختياري)
                        </label>
                        <textarea
                          value={editFeedback}
                          onChange={(e) => setEditFeedback(e.target.value)}
                          rows={4}
                          placeholder="أضف تعليقك أو ملاحظاتك..."
                          className="w-full px-3 md:px-4 py-3 md:py-3 border-2 border-primary-200/30 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/30 bg-white text-ink font-semibold resize-none text-sm md:text-base"
                          disabled={isGrading}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-2">
                        <Button
                          onClick={handleGradeSubmission}
                          variant="primary"
                          size="lg"
                          className="flex-1 text-sm md:text-base font-bold shadow-lg"
                          isLoading={isGrading}
                          disabled={isGrading}
                          icon={<Save className="w-4 h-4 md:w-5 md:h-5" />}
                        >
                          {isGrading ? 'جاري الحفظ...' : 'حفظ التقييم'}
                        </Button>
                        <Button
                          onClick={() => {
                            setViewingSubmission(null)
                            setEditGrade('')
                            setEditVoiceGrade('')
                            setEditFeedback('')
                          }}
                          variant="ghost"
                          size="lg"
                          className="text-sm md:text-base"
                          disabled={isGrading}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 border-slate-200 pt-6"></div>

                  {/* Grades Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    {viewingSubmission.auto_graded !== null && (
                      <div className="bg-white   rounded-lg p-3 md:p-4 border border-primary-200/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 md:w-5 md:h-5 text-primary-700" />
                          <label className="text-primary-700 font-semibold text-xs md:text-sm">تقييم AI</label>
                        </div>
                        <p className="text-ink font-bold text-lg md:text-2xl">{viewingSubmission.auto_graded}/100</p>
                      </div>
                    )}
                    {viewingSubmission.grade !== null && (
                      <div className="bg-white   rounded-lg p-3 md:p-4 border border-emerald-200/30">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-700" />
                          <label className="text-emerald-700 font-semibold text-xs md:text-sm">تقييم المعلم</label>
                        </div>
                        <p className="text-ink font-bold text-lg md:text-2xl">{viewingSubmission.grade}/100</p>
                      </div>
                    )}
                    {viewingSubmission.voice_grade !== null && (
                      <div className="bg-white   rounded-lg p-3 md:p-4 border border-secondary-200/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Mic className="w-4 h-4 md:w-5 md:h-5 text-secondary-700" />
                          <label className="text-secondary-700 font-semibold text-xs md:text-sm">تقييم القراءة الصوتية</label>
                        </div>
                        <p className="text-ink font-bold text-lg md:text-2xl">{viewingSubmission.voice_grade}/100</p>
                      </div>
                    )}
                  </div>

                  {/* AI Feedback */}
                  {viewingSubmission.auto_feedback && (
                    <div>
                      <label className="block text-primary-700 font-semibold mb-2 flex items-center gap-2 text-sm md:text-base">
                        <Brain className="w-4 h-4 md:w-5 md:h-5" />
                        تعليق AI
                      </label>
                      <div className="bg-white p-3 md:p-4 rounded-lg text-ink text-sm md:text-base whitespace-pre-wrap">
                        {viewingSubmission.auto_feedback}
                      </div>
                    </div>
                  )}

                  {/* Teacher Feedback */}
                  {viewingSubmission.feedback && (
                    <div>
                      <label className="block text-emerald-700 font-semibold mb-2 flex items-center gap-2 text-sm md:text-base">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                        تعليق المعلم
                      </label>
                      <div className="bg-white p-3 md:p-4 rounded-lg text-ink text-sm md:text-base whitespace-pre-wrap">
                        {viewingSubmission.feedback}
                      </div>
                    </div>
                  )}

                  {/* Audio Recording */}
                  {viewingSubmission.audio_url && (
                    <div>
                      <label className="block text-secondary-700 font-semibold mb-2 flex items-center gap-2 text-sm md:text-base">
                        <Mic className="w-4 h-4 md:w-5 md:h-5" />
                        التسجيل الصوتي للقراءة
                      </label>
                      <div className="bg-white p-3 md:p-4 rounded-lg">
                        <audio controls className="w-full">
                          <source
                            src={viewingSubmission.audio_url}
                            type={inferAudioMimeFromUrl(viewingSubmission.audio_url)}
                          />
                          متصفحك لا يدعم تشغيل الصوت
                        </audio>
                      </div>
                    </div>
                  )}

                  {/* Questions and Answers */}
                  <div>
                    <label className="block text-slate-600 font-semibold mb-3 text-sm md:text-base">الأسئلة والإجابات</label>
                    <div className="space-y-4">
                      {viewingSubmission.questions && viewingSubmission.questions.length > 0 ? (
                        viewingSubmission.questions.map((question: any, index: number) => {
                          const answer = viewingSubmission.responses[question.id]
                          
                          return (
                            <div key={question.id || index} className="bg-white p-3 md:p-4 rounded-lg">
                              <p className="text-sm md:text-base font-bold text-primary mb-2">
                                السؤال {index + 1}: {question.text_arabic}
                              </p>
                              <p className="text-ink text-sm md:text-base bg-white p-3 rounded-lg whitespace-pre-wrap">
                                {answer || 'لم يجب الطالب'}
                              </p>
                            </div>
                          )
                        })
                      ) : (
                        Object.entries(viewingSubmission.responses).map(([questionId, answer], index) => (
                          <div key={questionId} className="bg-white p-3 md:p-4 rounded-lg">
                            <p className="text-sm md:text-base font-bold text-primary mb-2">
                              السؤال {index + 1}
                            </p>
                            <p className="text-ink text-sm md:text-base bg-white p-3 rounded-lg whitespace-pre-wrap">
                              {answer as string}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Student Info */}
                  <div className="bg-white p-3 md:p-4 rounded-lg">
                    <h3 className="text-ink font-bold mb-2 text-sm md:text-base">معلومات الطالب</h3>
                    <div className="space-y-1 text-xs md:text-sm text-slate-600">
                      <p>الاسم: {viewingSubmission.student_name}</p>
                      <p>رمز الدخول: <bdi dir="ltr" className="font-mono">{viewingSubmission.student_access_code}</bdi></p>
                      <p>تاريخ الإرسال: {new Date(viewingSubmission.submitted_at).toLocaleString('ar-SA')}</p>
                      {viewingSubmission.graded_at && (
                        <p>تاريخ التقييم: {new Date(viewingSubmission.graded_at).toLocaleString('ar-SA')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

