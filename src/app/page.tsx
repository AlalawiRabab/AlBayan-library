'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { useAppStore } from '@/lib/store'
import { authService, leaderboardService } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { Trophy, Crown, Medal, Users, BookOpen } from 'lucide-react'
import { showPageLoader } from '@/components/PageTransitionLoader'
import Dialog from '@/components/Dialog'
import { FormField, TextInput } from '@/components/FormField'

interface LeaderboardEntry {
  id: string
  name: string
  stories_read: number
  forms_submitted: number
  combined_score: number
  grade: number
  current_title?: string
  avg_grade?: number
  graded_submissions?: number
}

// Allow all grades from 1 to 12
const ALLOWED_GRADES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

export default function HomePage() {
  const router = useRouter()
  const { setUser, setError, setLoading, isAuthenticated, userRole, hydrated } = useAppStore()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true)
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [studentName, setStudentName] = useState('')
  const [needsRegistration, setNeedsRegistration] = useState(false)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) return

    const role = userRole
    let destination = '/'

    switch (role) {
      case 'student':
        destination = '/student'
        break
      case 'teacher':
        destination = '/teacher'
        break
      case 'admin':
        destination = '/admin'
        break
      default:
        return
    }

    showPageLoader()
    router.replace(destination)
  }, [hydrated, isAuthenticated, userRole, router])

const loadLeaderboard = async () => {
  try {
    setIsLoadingLeaderboard(true)
    const data = (await leaderboardService.getLeaderboard()) as LeaderboardEntry[]
    console.log('Loaded leaderboard data:', data)
    const filteredLeaderboard = (data || []).filter((entry: LeaderboardEntry) => {
      const gradeNumber = Number(entry.grade)
      const gradedCount = Number(entry.graded_submissions ?? 0)
      return (
        !Number.isNaN(gradeNumber) &&
        ALLOWED_GRADES.has(gradeNumber) &&
        gradedCount > 0
      )
    })
    const top5 = filteredLeaderboard.slice(0, 5)
    
    console.log('Filtered top students:', top5)
    setLeaderboard(top5)
  } catch (error) {
    console.error('Error loading leaderboard:', error)
    setLeaderboard([]) // Set empty array on error
  } finally {
    setIsLoadingLeaderboard(false)
  }
}

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoading(true)

    try {
      if (needsRegistration) {
        // Student registration
        const student = await authService.registerStudent(accessCode, studentName)
        setUser(student, 'student')
        toast.success(`مرحباً ${studentName}! تم إنشاء حسابك بنجاح `)
        showPageLoader()
        router.push('/student')
      } else {
        // Student login only
        const result = await authService.loginWithAccessCode(accessCode)
        
        if (result.type === 'student') {
          setUser(result.user, result.type)
          toast.success(`مرحباً ${result.user.name}! `)
          showPageLoader()
          router.push('/student')
        } else {
          // If admin or teacher, redirect to access portal
          toast.error('للمسؤولين والمعلمين، الرجاء استخدام بوابة الإدارة')
          setShowLoginForm(false)
          setTimeout(() => {
            showPageLoader()
            router.push('/access')
          }, 1500)
          setIsLoading(false)
          setLoading(false)
        }
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message)
      
      if (error.message.includes('not found')) {
        setNeedsRegistration(true)
        toast('هذا أول دخول لك! الرجاء إدخال اسمك', { icon: '' })
      } else {
        toast.error(error.message)
      }
      setIsLoading(false)
      setLoading(false)
    }
  }

  return (
    <AnimatedBackground>
      <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8" dir="rtl">
        <div className="max-w-7xl w-full">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 text-center"
          >
            <div className="flex flex-col items-center gap-0.5 mb-2">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
                <Image
                  src="/logow.png" 
                  alt="البيان" 
                  width={224}
                  height={128}
                  priority
                  className="h-28 w-48 object-contain sm:h-32 sm:w-56"
                />
              </motion.div>
              <h1 className="font-heading text-3xl font-extrabold text-ink md:text-4xl">
                البيان
              </h1>
            </div>
            <p className="mx-auto mb-2 max-w-2xl text-sm text-slate-600 md:text-base">
              منصة تعليمية تفاعلية لتعلم اللغة العربية
            </p>
          </motion.div>

          {/* Leaderboard Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-4 md:mb-6"
          >
            <Card className="overflow-hidden border-slate-300 p-4 sm:p-5 md:p-6" elevation="sm">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <Trophy className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
                <h2 className="text-lg md:text-xl font-bold text-ink">جدول الترتيب (الصفوف 3، 5، 6)</h2>
              </div>
              
              {isLoadingLeaderboard ? (
                <div className="text-center py-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-slate-600 mt-1 text-sm">جاري تحميل الترتيب...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-2">
                  <Users className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                  <p className="text-slate-600 text-sm">لا يوجد طلاب مقيمون في هذه الصفوف بعد</p>
                  <p className="text-slate-500 text-xs">كن أول من ينضم إلى المكتبة!</p>
                </div>
              ) : (
                <>
                  {/* Top 3 - Podium View */}
                  <div className="grid grid-cols-3 gap-2 md:flex md:justify-center md:items-end md:gap-3 py-2 mb-3">
                    {/* 2nd Place */}
                    {leaderboard[1] && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex flex-col items-center"
                      >
                        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary-200 bg-primary-100 text-primary-700 shadow-card sm:h-14 sm:w-14 md:mb-3 md:h-20 md:w-20">
                          <Medal className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="w-full rounded-xl border-2 border-primary-200 bg-primary-50 p-2 text-center shadow-card md:w-auto md:min-w-[120px] md:max-w-[120px] md:p-4">
                          <h3 className="text-xs sm:text-sm md:text-lg font-bold text-ink break-words leading-tight px-1">{leaderboard[1].name}</h3>
                          <p className="text-[10px] font-semibold text-primary-700 sm:text-xs md:text-sm">المركز الثاني</p>
                          {leaderboard[1].current_title && (
                            <div className="mt-1 truncate rounded-full border border-primary-200 bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-700">
                               {leaderboard[1].current_title}
                            </div>
                          )}
                          <div className="mt-2 text-lg font-extrabold text-primary-700 md:text-xl">{leaderboard[1].combined_score}</div>
                          {leaderboard[1].avg_grade && (
                            <div className="text-xs md:text-sm text-secondary-700 mt-1">
                              معدل: <bdi dir="ltr">{Math.round(leaderboard[1].avg_grade)}%</bdi>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* 1st Place */}
                    {leaderboard[0] && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="flex flex-col items-center"
                      >
                        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-100 text-amber-800 shadow-lg sm:h-16 sm:w-16 md:mb-3 md:h-24 md:w-24">
                          <Crown className="w-6 h-6 sm:w-7 sm:h-7 md:w-10 md:h-10" />
                        </div>
                        <div className="w-full rounded-xl border-2 border-amber-400 bg-amber-50 p-2 text-center shadow-card md:w-auto md:min-w-[140px] md:max-w-[140px] md:p-4">
                          <h3 className="text-sm sm:text-base md:text-xl font-bold text-ink break-words leading-tight px-1">{leaderboard[0].name}</h3>
                          <p className="text-[10px] font-bold text-amber-800 sm:text-xs md:text-sm">المركز الأول</p>
                          {leaderboard[0].current_title && (
                            <div className="mt-1 truncate rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                               {leaderboard[0].current_title}
                            </div>
                          )}
                          <div className="mt-2 text-xl font-extrabold text-amber-800 md:text-2xl">{leaderboard[0].combined_score}</div>
                          {leaderboard[0].avg_grade && (
                            <div className="text-xs md:text-sm text-secondary-700 mt-1">
                              معدل: <bdi dir="ltr">{Math.round(leaderboard[0].avg_grade)}%</bdi>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* 3rd Place */}
                    {leaderboard[2] && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col items-center"
                      >
                        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-orange-300 bg-orange-100 text-orange-800 shadow-card sm:h-14 sm:w-14 md:mb-3 md:h-20 md:w-20">
                          <Medal className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="w-full rounded-xl border-2 border-orange-300 bg-orange-50 p-2 text-center shadow-card md:w-auto md:min-w-[120px] md:max-w-[120px] md:p-4">
                          <h3 className="text-xs sm:text-sm md:text-lg font-bold text-ink break-words leading-tight px-1">{leaderboard[2].name}</h3>
                          <p className="text-xs font-semibold text-orange-800 md:text-sm">المركز الثالث</p>
                          {leaderboard[2].current_title && (
                            <div className="mt-1 truncate rounded-full border border-orange-300 bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900">
                               {leaderboard[2].current_title}
                            </div>
                          )}
                          <div className="mt-2 text-lg font-extrabold text-orange-800 md:text-xl">{leaderboard[2].combined_score}</div>
                          {leaderboard[2].avg_grade && (
                            <div className="text-xs md:text-sm text-secondary-700 mt-1">
                              معدل: <bdi dir="ltr">{Math.round(leaderboard[2].avg_grade)}%</bdi>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* 4th and 5th Place - Side by Side */}
                  {(leaderboard[3] || leaderboard[4]) && (
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      {leaderboard[3] && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.4 }}
                          className="flex flex-col items-center"
                        >
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary-200 bg-primary-100 text-primary-700 shadow-card md:mb-3 md:h-16 md:w-16">
                            <Medal className="w-5 h-5 md:w-7 md:h-7" />
                          </div>
                          <div className="min-w-full rounded-xl border-2 border-primary-200 bg-primary-50 p-2 text-center shadow-card md:p-3">
                            <h3 className="text-sm md:text-base font-bold text-ink break-words leading-tight px-1 mb-1">{leaderboard[3].name}</h3>
                            <div className="mb-1 text-xs font-semibold text-primary-700 md:text-sm">المركز الرابع</div>
                            {leaderboard[3].current_title && (
                              <div className="my-1 truncate rounded-full border border-primary-200 bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-700">
                                 {leaderboard[3].current_title}
                              </div>
                            )}
                            <div className="mt-1 text-lg font-extrabold text-primary-700 md:text-xl">{leaderboard[3].combined_score}</div>
                            {leaderboard[3].avg_grade && (
                              <div className="text-xs md:text-sm text-secondary-700 mt-1">
                                معدل: <bdi dir="ltr">{Math.round(leaderboard[3].avg_grade)}%</bdi>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {leaderboard[4] && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.5 }}
                          className="flex flex-col items-center"
                        >
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-secondary-200 bg-secondary-100 text-secondary-700 shadow-card md:mb-3 md:h-16 md:w-16">
                            <Medal className="w-5 h-5 md:w-7 md:h-7" />
                          </div>
                          <div className="min-w-full rounded-xl border-2 border-secondary-200 bg-secondary-50 p-2 text-center shadow-card md:p-3">
                            <h3 className="text-sm md:text-base font-bold text-ink break-words leading-tight px-1 mb-1">{leaderboard[4].name}</h3>
                            <div className="mb-1 text-xs font-semibold text-secondary-700 md:text-sm">المركز الخامس</div>
                            {leaderboard[4].current_title && (
                              <div className="my-1 truncate rounded-full border border-secondary-200 bg-secondary-100 px-2 py-1 text-xs font-semibold text-secondary-700">
                                 {leaderboard[4].current_title}
                              </div>
                            )}
                            <div className="mt-1 text-lg font-extrabold text-secondary-700 md:text-xl">{leaderboard[4].combined_score}</div>
                            {leaderboard[4].avg_grade && (
                              <div className="text-xs md:text-sm text-secondary-700 mt-1">
                                معدل: <bdi dir="ltr">{Math.round(leaderboard[4].avg_grade)}%</bdi>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>
          </motion.div>

          {/* Student Login Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-md mx-auto mb-4"
          >
            <Card className="p-5 text-center md:p-7" variant="interactive">
              <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-accent-green mx-auto mb-3" />
              <h3 className="text-lg md:text-xl font-bold text-ink mb-2">تسجيل الدخول</h3>
              <p className="text-slate-600 mb-4 text-sm md:text-base">تسجيل الدخول للطالب والمعلم</p>
              <Button
                onClick={() => setShowLoginForm(true)}
                variant="success"
                size="lg"
                className="w-full"
                icon={<BookOpen className="w-5 h-5" />}
              >
                تسجيل الدخول
              </Button>
            </Card>
          </motion.div>

          <Dialog open={showLoginForm} onOpenChange={setShowLoginForm} title="تسجيل دخول الطالب" description="أدخل رمز الدخول الذي حصلت عليه من معلمك." size="sm">
                <form onSubmit={handleLogin} className="space-y-4">
                  <FormField id="student-access-code" label="رمز الدخول" required>
                    <TextInput
                      id="student-access-code"
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="أدخل رمز الدخول"
                      className="ltr-isolate font-mono font-bold tracking-wider"
                      required
                      disabled={isLoading}
                    />
                  </FormField>

                  {needsRegistration && (
                    <FormField id="student-name" label="اسمك الكامل" required>
                      <TextInput
                        id="student-name"
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="أدخل اسمك الكامل"
                        required
                        disabled={isLoading}
                      />
                    </FormField>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="flex-1"
                      isLoading={isLoading}
                      disabled={isLoading}
                    >
                      {needsRegistration ? 'إنشاء الحساب' : 'دخول'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        setShowLoginForm(false)
                        setNeedsRegistration(false)
                        setAccessCode('')
                        setStudentName('')
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
          </Dialog>
        </div>
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#FFFFFF',
            color: '#172033',
            border: '1px solid #DBE4EE',
            boxShadow: '0 12px 32px rgba(23, 32, 51, 0.12)',
          },
        }}
      />
    </AnimatedBackground>
  )
}

