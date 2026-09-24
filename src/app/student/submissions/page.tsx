'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { useAppStore } from '@/lib/store'
import { studentSubmissionsService } from '@/lib/supabase'
import { calculateFinalGrade } from '@/lib/voiceGradingLogic'
import toast, { Toaster } from 'react-hot-toast'
import { 
  BookOpen,
  FileText,
  Award,
  Mic,
  Star,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Clock
} from 'lucide-react'

interface Submission {
  submission_id: string
  story_title: string
  form_title: string
  submitted_at: string
  grade?: number
  voice_grade?: number
  feedback?: string
}

export default function StudentSubmissionsPage() {
  const router = useRouter()
  const { user, isAuthenticated, hydrated } = useAppStore()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated || !user) {
      router.push('/')
      return
    }

    loadSubmissions()
  }, [hydrated, isAuthenticated, user, router])

  const loadSubmissions = async () => {
    try {
      setIsLoading(true)
      
      const studentData = user as any
      const studentAccessCode = studentData.access_code
      
      const submissionsData = await studentSubmissionsService.getStudentSubmissions(studentAccessCode)
      setSubmissions(submissionsData || [])
    } catch (error) {
      console.error('Error loading submissions:', error)
      toast.error('فشل تحميل الإجابات')
    } finally {
      setIsLoading(false)
    }
  }

  const getGradeColor = (finalGrade: number) => {
    if (finalGrade >= 90) return 'text-emerald-700'
    if (finalGrade >= 70) return 'text-primary-700'
    if (finalGrade >= 50) return 'text-amber-700'
    return 'text-rose-700'
  }

  const getGradeBgColor = (finalGrade: number) => {
    if (finalGrade >= 90) return '  border-emerald-200/30'
    if (finalGrade >= 70) return '  border-primary-200/30'
    if (finalGrade >= 50) return '  border-amber-200/30'
    return '  border-rose-200/30'
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="page-container min-h-screen"
      >
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-center mb-8"
          >
            <div>
              <h1 className="text-4xl font-bold text-ink mb-2 flex items-center gap-3">
                <Star className="w-8 h-8 text-secondary" />
                إجاباتي وتقييماتي
              </h1>
              <p className="text-slate-700">اطلع على تقييماتك من المعلم</p>
            </div>
            <Button
              onClick={() => router.push('/student')}
              variant="ghost"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              العودة
            </Button>
          </motion.div>

          {/* Submissions List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {isLoading ? (
              <Card>
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-slate-500 mx-auto mb-4 animate-spin" />
                  <p className="text-slate-700">جاري التحميل...</p>
                </div>
              </Card>
            ) : submissions.length === 0 ? (
              <Card>
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-ink mb-2">لا توجد إجابات حتى الآن</h3>
                  <p className="text-slate-500">ابدأ بقراءة القصص وإرسال الإجابات!</p>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {submissions.map((submission, index) => {
                  const finalGrade = calculateFinalGrade(submission.grade, submission.voice_grade)
                  
                  return (
                    <motion.div
                      key={submission.submission_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="transition-shadow hover:shadow-lg">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Story Info */}
                          <div className="md:col-span-6">
                            <div className="flex items-start gap-3 mb-3">
                              <BookOpen className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                              <div>
                                <h3 className="font-bold text-ink mb-1">{submission.story_title}</h3>
                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  {submission.form_title}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500">
                              {new Date(submission.submitted_at).toLocaleDateString('ar-SA')}
                            </p>
                          </div>

                          {/* Grades */}
                          {finalGrade !== null ? (
                            <div className="md:col-span-6 grid grid-cols-2 gap-3">
                              {/* Final Grade */}
                              <div className={`bg-white ${getGradeBgColor(finalGrade)} rounded-lg p-3 border text-center`}>
                                <label className="block text-ink font-semibold mb-1 text-xs">
                                  المعدل النهائي
                                </label>
                                <p className={`font-bold text-2xl ${getGradeColor(finalGrade)}`}>
                                  {finalGrade}/100
                                </p>
                              </div>

                              {/* Questions Grade */}
                              {submission.grade !== null && submission.grade !== undefined && (
                                <div className="bg-white   rounded-lg p-3 border border-primary-200/30 text-center">
                                  <label className="block text-primary-700 font-semibold mb-1 text-xs">
                                    درجة الأسئلة
                                  </label>
                                  <p className="text-ink font-bold text-lg">{submission.grade}/100</p>
                                </div>
                              )}

                              {/* Voice Grade */}
                              {submission.voice_grade !== null && submission.voice_grade !== undefined ? (
                                <div className="bg-white   rounded-lg p-3 border border-secondary-200/30 text-center">
                                  <label className="block text-secondary-700 font-semibold mb-1 text-xs">
                                    درجة القراءة الصوتية
                                  </label>
                                  <p className="text-ink font-bold text-lg">{submission.voice_grade}/100</p>
                                </div>
                              ) : (
                                <div className="bg-white rounded-lg p-3 border border-amber-200/30 text-center">
                                  <label className="block text-amber-700 font-semibold mb-1 text-xs">
                                    درجة القراءة الصوتية
                                  </label>
                                  <p className="text-amber-700 font-semibold text-sm">بانتظار مراجعة المعلمة</p>
                                </div>
                              )}

                              {/* Feedback */}
                              {submission.feedback && (
                                <div className="col-span-2 bg-white rounded-lg p-3 text-sm text-slate-600">
                                  <CheckCircle className="w-4 h-4 inline-block ms-1 text-emerald-700" />
                                  {submission.feedback}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="md:col-span-6 flex items-center justify-center">
                              <div className="text-center">
                                <Clock className="w-12 h-12 text-amber-700 mx-auto mb-2" />
                                <p className="text-amber-700 font-semibold">في انتظار التقييم</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Stats Summary */}
          {!isLoading && submissions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8"
            >
              <Card>
                <h3 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-accent-green" />
                  ملخص إنجازاتك
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total Submissions */}
                  <div className="bg-white rounded-lg p-4 text-center">
                    <FileText className="w-8 h-8 text-primary-700 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-ink mb-1">{submissions.length}</div>
                    <p className="text-sm text-slate-500">إجمالي الإجابات</p>
                  </div>

                  {/* Graded Submissions */}
                  <div className="bg-white rounded-lg p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-700 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-ink mb-1">
                      {submissions.filter(s => calculateFinalGrade(s.grade, s.voice_grade) !== null).length}
                    </div>
                    <p className="text-sm text-slate-500">مقيم</p>
                  </div>

                  {/* Average Grade */}
                  {(() => {
                    const gradedSubmissions = submissions.filter(s => {
                      const finalGrade = calculateFinalGrade(s.grade, s.voice_grade)
                      return finalGrade !== null && finalGrade !== undefined
                    })
                    
                    if (gradedSubmissions.length === 0) return null
                    
                    const avgGrade = Math.round(
                      gradedSubmissions.reduce((sum, s) => sum + calculateFinalGrade(s.grade, s.voice_grade)!, 0) / gradedSubmissions.length
                    )
                    
                    return (
                      <div className="bg-white   rounded-lg p-4 text-center border border-secondary-200/30">
                        <Award className="w-8 h-8 text-secondary-700 mx-auto mb-2" />
                        <div dir="ltr" className="mb-1 text-2xl font-bold text-ink">{avgGrade}%</div>
                        <p className="text-sm text-slate-500">المعدل العام</p>
                      </div>
                    )
                  })()}

                  {/* Pending */}
                  <div className="bg-white rounded-lg p-4 text-center">
                    <Clock className="w-8 h-8 text-amber-700 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-ink mb-1">
                      {submissions.filter(s => calculateFinalGrade(s.grade, s.voice_grade) === null).length}
                    </div>
                    <p className="text-sm text-slate-500">في الانتظار</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatedBackground>
  )
}

