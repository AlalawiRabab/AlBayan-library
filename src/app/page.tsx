'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { useAppStore } from '@/lib/store'
import { authService, leaderboardService } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { Trophy, Crown, Medal, Users, BookOpen, LogIn, UserCheck, Shield, GraduationCap } from 'lucide-react'
import { showPageLoader } from '@/components/PageTransitionLoader'

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
        toast.success(`مرحباً ${studentName}! تم إنشاء حسابك بنجاح 🎉`)
        showPageLoader()
        router.push('/student')
      } else {
        // Student login only
        const result = await authService.loginWithAccessCode(accessCode)
        
        if (result.type === 'student') {
          setUser(result.user, result.type)
          toast.success(`مرحباً ${result.user.name}! 👦`)
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
        toast('هذا أول دخول لك! الرجاء إدخال اسمك', { icon: '👋' })
      } else {
        toast.error(error.message)
      }
      setIsLoading(false)
      setLoading(false)
    }
  }

  return (
    <AnimatedBackground>
      <div className="w-full min-h-screen flex items-center justify-center px-2 sm:px-3 md:px-4 py-4 overflow-x-hidden" dir="rtl">
        <div className="max-w-7xl w-full">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-4 md:mb-6"
          >
            <div className="flex flex-col items-center gap-0.5 mb-2">
              <motion.div
                animate={{ 
                  y: [0, -5, 0],
                  scale: [1, 1.02, 1]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="relative"
              >
                <img 
                  src="/logow.png" 
                  alt="البيان" 
                  className="w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-80 lg:h-80 object-contain drop-shadow-2xl"
                />
              </motion.div>
              <h1 className="text-xl md:text-4xl font-bold text-white">
                البيان
              </h1>
            </div>
            <p className="text-sm md:text-base text-gray-300 mb-2">
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
            <Card className="p-2 sm:p-2.5 md:p-3 overflow-hidden">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <Trophy className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
                <h2 className="text-lg md:text-xl font-bold text-white">جدول الترتيب (الصفوف 3، 5، 6)</h2>
              </div>
              
              {isLoadingLeaderboard ? (
                <div className="text-center py-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-gray-300 mt-1 text-sm">جاري تحميل الترتيب...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-2">
                  <Users className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                  <p className="text-gray-300 text-sm">لا يوجد طلاب مقيمون في هذه الصفوف بعد</p>
                  <p className="text-gray-400 text-xs">كن أول من ينضم إلى المكتبة!</p>
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
                        <div className="bg-gradient-to-b from-gray-300 to-gray-400 text-slate-900 w-12 h-12 sm:w-14 sm:h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-2 md:mb-3">
                          <Medal className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-2 md:p-4 text-center w-full md:w-auto md:min-w-[120px] md:max-w-[120px]">
                          <h3 className="text-xs sm:text-sm md:text-lg font-bold text-white break-words leading-tight px-1">{leaderboard[1].name}</h3>
                          <p className="text-[10px] sm:text-xs md:text-sm text-gray-300">المركز الثاني</p>
                          {leaderboard[1].current_title && (
                            <div className="text-xs bg-gray-600/50 text-gray-300 px-2 py-1 rounded-full mt-1 truncate">
                              🏅 {leaderboard[1].current_title}
                            </div>
                          )}
                          <div className="text-lg md:text-xl font-bold text-gray-300 mt-2">{leaderboard[1].combined_score}</div>
                          {leaderboard[1].avg_grade && (
                            <div className="text-xs md:text-sm text-purple-300 mt-1">
                              معدل: {Math.round(leaderboard[1].avg_grade)}%
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
                        <div className="bg-gradient-to-b from-yellow-400 to-yellow-600 text-white w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-2 md:mb-3 shadow-lg">
                          <Crown className="w-6 h-6 sm:w-7 sm:h-7 md:w-10 md:h-10" />
                        </div>
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 backdrop-blur-sm rounded-lg p-2 md:p-4 text-center w-full md:w-auto md:min-w-[140px] md:max-w-[140px] border-2 border-yellow-500/30">
                          <h3 className="text-sm sm:text-base md:text-xl font-bold text-white break-words leading-tight px-1">{leaderboard[0].name}</h3>
                          <p className="text-[10px] sm:text-xs md:text-sm text-yellow-300">المركز الأول</p>
                          {leaderboard[0].current_title && (
                            <div className="text-xs bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded-full mt-1 truncate">
                              🏅 {leaderboard[0].current_title}
                            </div>
                          )}
                          <div className="text-xl md:text-2xl font-bold text-yellow-300 mt-2">{leaderboard[0].combined_score}</div>
                          {leaderboard[0].avg_grade && (
                            <div className="text-xs md:text-sm text-purple-300 mt-1">
                              معدل: {Math.round(leaderboard[0].avg_grade)}%
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
                        <div className="bg-gradient-to-b from-amber-600 to-amber-700 text-white w-12 h-12 sm:w-14 sm:h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-2 md:mb-3">
                          <Medal className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-2 md:p-4 text-center w-full md:w-auto md:min-w-[120px] md:max-w-[120px]">
                          <h3 className="text-xs sm:text-sm md:text-lg font-bold text-white break-words leading-tight px-1">{leaderboard[2].name}</h3>
                          <p className="text-xs md:text-sm text-gray-300">المركز الثالث</p>
                          {leaderboard[2].current_title && (
                            <div className="text-xs bg-amber-600/50 text-amber-300 px-2 py-1 rounded-full mt-1 truncate">
                              🏅 {leaderboard[2].current_title}
                            </div>
                          )}
                          <div className="text-lg md:text-xl font-bold text-gray-300 mt-2">{leaderboard[2].combined_score}</div>
                          {leaderboard[2].avg_grade && (
                            <div className="text-xs md:text-sm text-purple-300 mt-1">
                              معدل: {Math.round(leaderboard[2].avg_grade)}%
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
                          <div className="bg-gradient-to-b from-purple-400 to-purple-600 text-white w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-2 md:mb-3">
                            <Medal className="w-5 h-5 md:w-7 md:h-7" />
                          </div>
                          <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-2 md:p-3 text-center min-w-full">
                            <h3 className="text-sm md:text-base font-bold text-white break-words leading-tight px-1 mb-1">{leaderboard[3].name}</h3>
                            <div className="text-xs md:text-sm text-gray-300 mb-1">المركز الرابع</div>
                            {leaderboard[3].current_title && (
                              <div className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full my-1 truncate">
                                🏅 {leaderboard[3].current_title}
                              </div>
                            )}
                            <div className="text-lg md:text-xl font-bold text-gray-300 mt-1">{leaderboard[3].combined_score}</div>
                            {leaderboard[3].avg_grade && (
                              <div className="text-xs md:text-sm text-purple-300 mt-1">
                                معدل: {Math.round(leaderboard[3].avg_grade)}%
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
                          <div className="bg-gradient-to-b from-purple-400 to-purple-600 text-white w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-2 md:mb-3">
                            <Medal className="w-5 h-5 md:w-7 md:h-7" />
                          </div>
                          <div className="bg-slate-700/80 backdrop-blur-sm rounded-lg p-2 md:p-3 text-center min-w-full">
                            <h3 className="text-sm md:text-base font-bold text-white break-words leading-tight px-1 mb-1">{leaderboard[4].name}</h3>
                            <div className="text-xs md:text-sm text-gray-300 mb-1">المركز الخامس</div>
                            {leaderboard[4].current_title && (
                              <div className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full my-1 truncate">
                                🏅 {leaderboard[4].current_title}
                              </div>
                            )}
                            <div className="text-lg md:text-xl font-bold text-gray-300 mt-1">{leaderboard[4].combined_score}</div>
                            {leaderboard[4].avg_grade && (
                              <div className="text-xs md:text-sm text-purple-300 mt-1">
                                معدل: {Math.round(leaderboard[4].avg_grade)}%
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
            <Card className="p-4 md:p-6 text-center hover:scale-105 transition-transform duration-200">
              <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-accent-green mx-auto mb-3" />
              <h3 className="text-lg md:text-xl font-bold text-white mb-2">تسجيل الدخول</h3>
              <p className="text-gray-300 mb-4 text-sm md:text-base">تسجيل الدخول للطالب والمعلم</p>
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

          {/* Login Form Modal */}
          {showLoginForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto"
              onClick={() => setShowLoginForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-800 rounded-xl p-3 md:p-4 w-full max-w-md my-4 md:my-8 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                  <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-accent-green flex-shrink-0" />
                  <h3 className="text-lg md:text-xl font-bold text-white">
                    تسجيل الدخول
                  </h3>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="block text-gray-300 font-semibold mb-2">
                      رمز الدخول
                    </label>
                    <input
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="أدخل رمز الدخول"
                      className="w-full px-4 py-3 border-2 border-slate-700 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-slate-900 text-white font-semibold"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {needsRegistration && (
                    <div>
                      <label className="block text-gray-300 font-semibold mb-2">
                        اسمك الكامل
                      </label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="أدخل اسمك الكامل"
                        className="w-full px-4 py-3 border-2 border-slate-700 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-slate-900 text-white font-semibold"
                        required
                        disabled={isLoading}
                      />
                    </div>
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
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1E293B',
            color: '#F1F5F9',
            border: '1px solid #334155',
          },
        }}
      />
    </AnimatedBackground>
  )
}

