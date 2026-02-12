'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { leaderboardService, studentsService } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import toast, { Toaster } from 'react-hot-toast'
import { Trophy, Medal, Crown, Star, TrendingUp, Home, Eye, X, BookOpen, FileText, Award, Calendar } from 'lucide-react'

interface LeaderboardEntry {
  student_id: string
  name: string
  stories_read: number
  forms_submitted: number
  combined_score: number
  rank: number
  current_title?: string
  grade?: number
  avg_grade?: number
  graded_submissions?: number
  total_score?: number
}

type MedalVariant = 'gold' | 'silver' | 'bronze' | 'default'

const titleVariantMap: Record<string, MedalVariant> = {
  'قارئ أسطوري': 'gold',
  'سفيرة القراء': 'gold',
  'قارئ محترف': 'silver',
  'قارئ متميز': 'bronze',
}

const getMedalVariant = (title?: string): MedalVariant => {
  if (!title) return 'default'
  return titleVariantMap[title] ?? 'default'
}

export default function LeaderboardPage() {
  const router = useRouter()
  const { user, userRole, hydrated, selectedClassroomId } = useAppStore()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (!user || userRole === null) {
      router.push('/')
      return
    }
    loadLeaderboard()
  }, [hydrated, user, userRole, selectedClassroomId, router])

  // Add focus listener to refresh leaderboard when returning to the page
  useEffect(() => {
    const handleFocus = () => {
      console.log('Leaderboard page focused, refreshing data...')
      loadLeaderboard()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const loadLeaderboard = async () => {
    try {
      setIsLoading(true)
      let data
      // Teachers should ONLY see their class leaderboard, not global
      if (userRole === 'teacher') {
        const teacherAccessCode = (user as any)?.access_code
        if (!teacherAccessCode) {
          toast.error('لا يمكن تحديد صف المعلمة')
          setLeaderboard([])
          return
        }
        // Get leaderboard for teacher's assigned class only
        data = await leaderboardService.getTeacherLeaderboard(teacherAccessCode)
        console.log('Teacher class leaderboard loaded:', data?.length, 'students')
      } else if (userRole === 'admin') {
        data = await leaderboardService.getLeaderboard()
        console.log('Global leaderboard loaded:', data?.length, 'students')
      } else if (userRole === 'student') {
        const accessCode = (user as any)?.access_code
        if (!accessCode) {
          toast.error('بيانات الطالب غير متوفرة')
          setLeaderboard([])
          return
        }
        let classroomId = selectedClassroomId
        if (!classroomId) {
          const list = await studentsService.getClassrooms(accessCode)
          classroomId = list?.[0]?.classroom_id ?? null
        }
        if (!classroomId) {
          toast.error('لا يوجد فصل محدد')
          setLeaderboard([])
          return
        }
        data = await leaderboardService.getLeaderboardByClassroom(accessCode, classroomId)
        console.log('Student class leaderboard loaded:', data?.length, 'students')
      } else {
        router.push('/')
        return
      }
      setLeaderboard(data || [])
    } catch (error) {
      console.error('Error loading leaderboard:', error)
      toast.error('فشل تحميل جدول الترتيب')
    } finally {
      setIsLoading(false)
    }
  }

  const showStudentDetails = (student: LeaderboardEntry) => {
    setSelectedStudent(student)
    setShowDetails(true)
  }

  const closeStudentDetails = () => {
    setShowDetails(false)
    setSelectedStudent(null)
  }

  const getRankIcon = (index: number, title?: string) => {
    const variant = getMedalVariant(title)
    if (variant === 'gold') return <Crown className="w-8 h-8 text-yellow-400" />
    if (variant === 'silver') return <Medal className="w-8 h-8 text-gray-300" />
    if (variant === 'bronze') return <Medal className="w-8 h-8 text-amber-600" />

    switch (index) {
      case 0:
        return <Crown className="w-8 h-8 text-yellow-400" />
      case 1:
        return <Medal className="w-8 h-8 text-gray-300" />
      case 2:
        return <Medal className="w-8 h-8 text-amber-600" />
      default:
        return <Star className="w-6 h-6 text-blue-400" />
    }
  }

  const getRankBadgeClass = (entry: LeaderboardEntry, index: number) => {
    const variant = getMedalVariant(entry.current_title)
    if (variant === 'gold') return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white'
    if (variant === 'silver') return 'bg-gradient-to-r from-gray-300 to-gray-400 text-slate-900'
    if (variant === 'bronze') return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white'

    if (index === 0) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white'
    if (index === 1) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-slate-900'
    if (index === 2) return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white'
    return 'bg-slate-700 text-gray-300'
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="w-full min-h-screen p-4 md:p-6 overflow-x-hidden" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <Trophy className="w-10 h-10 text-yellow-400" />
                جدول الترتيب
              </h1>
              <p className="text-gray-300 text-lg font-semibold">
                {userRole === 'teacher' && leaderboard.length > 0 
                  ? `الصف ${leaderboard[0]?.grade} - أفضل القراء المتميزين`
                  : userRole === 'teacher'
                  ? 'أفضل القراء المتميزين في صفك'
                  : 'أفضل القراء المتميزين'}
              </p>
            </div>
            <Button
              onClick={() => router.push('/')}
              variant="ghost"
              size="md"
              icon={<Home className="w-5 h-5" />}
            >
              الرئيسية
            </Button>
          </div>

          {/* Top 3 Podium */}
          {!isLoading && leaderboard.length >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8 md:mb-12 overflow-x-auto -mx-2 sm:-mx-0 px-2 sm:px-0"
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 items-end min-w-[280px] sm:min-w-0">
                {/* 2nd Place */}
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <Card className="bg-gradient-to-b from-gray-700 to-gray-800 p-3 sm:p-4 md:p-6">
                    <div className="flex justify-center mb-2 sm:mb-3">
                      <Medal className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-gray-300" />
                    </div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-300 mb-1 sm:mb-2">2</div>
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-1 sm:mb-2 truncate">
                      {leaderboard[1]?.name}
                    </h3>
                    <div className="flex justify-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                      <div className="text-center">
                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary mx-auto mb-1" />
                        <p className="text-gray-400 text-[10px] sm:text-xs">قصة</p>
                        <p className="text-sm sm:text-base md:text-lg font-bold text-primary">
                          {leaderboard[1]?.stories_read}
                        </p>
                      </div>
                      <div className="text-center">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent-green mx-auto mb-1" />
                        <p className="text-gray-400 text-[10px] sm:text-xs">نموذج</p>
                        <p className="text-sm sm:text-base md:text-lg font-bold text-accent-green">
                          {leaderboard[1]?.forms_submitted}
                        </p>
                      </div>
                    </div>
                    {leaderboard[1]?.current_title && (
                      <div className="mt-1 sm:mt-2 text-center">
                        <span className="text-[10px] sm:text-xs bg-gray-600/50 text-gray-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full truncate inline-block max-w-full">
                          🏅 {leaderboard[1].current_title}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 sm:mt-3 text-lg sm:text-xl md:text-2xl font-bold text-secondary">
                      {leaderboard[1]?.combined_score} نقطة
                    </div>
                  </Card>
                </motion.div>

                {/* 1st Place */}
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center relative z-10"
                >
                  <Card className="bg-gradient-to-b from-yellow-600 to-yellow-700 p-4 sm:p-6 md:p-8 sm:scale-105 md:scale-110 relative overflow-visible">
                    <div className="absolute -top-4 sm:-top-6 left-1/2 transform -translate-x-1/2">
                      <Crown className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-yellow-300 animate-bounce-gentle" />
                    </div>
                    <div className="flex justify-center mb-2 sm:mb-3 mt-2 sm:mt-4">
                      <Trophy className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 text-yellow-200" />
                    </div>
                    <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">1</div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 truncate">
                      {leaderboard[0]?.name}
                    </h3>
                    <div className="flex justify-center gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm">
                      <div className="text-center">
                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-200 mx-auto mb-1" />
                        <p className="text-yellow-200 text-[10px] sm:text-xs">قصة</p>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {leaderboard[0]?.stories_read}
                        </p>
                      </div>
                      <div className="text-center">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-200 mx-auto mb-1" />
                        <p className="text-yellow-200 text-[10px] sm:text-xs">نموذج</p>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {leaderboard[0]?.forms_submitted}
                        </p>
                      </div>
                    </div>
                    {leaderboard[0]?.current_title && (
                      <div className="mt-3 text-center">
                        <span className="text-sm bg-yellow-500/20 text-yellow-200 px-3 py-1 rounded-full border border-yellow-400/30">
                          👑 {leaderboard[0].current_title}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 sm:mt-4 text-lg sm:text-2xl md:text-3xl font-bold text-white">
                      {leaderboard[0]?.combined_score} نقطة
                    </div>
                  </Card>
                </motion.div>

                {/* 3rd Place */}
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-center"
                >
                  <Card className="bg-gradient-to-b from-amber-700 to-amber-800 p-3 sm:p-4 md:p-6">
                    <div className="flex justify-center mb-2 sm:mb-3">
                      <Medal className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-amber-500" />
                    </div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-400 mb-1 sm:mb-2">3</div>
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-1 sm:mb-2 truncate">
                      {leaderboard[2]?.name}
                    </h3>
                    <div className="flex justify-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                      <div className="text-center">
                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary mx-auto mb-1" />
                        <p className="text-gray-400 text-[10px] sm:text-xs">قصة</p>
                        <p className="text-sm sm:text-base md:text-lg font-bold text-primary">
                          {leaderboard[2]?.stories_read}
                        </p>
                      </div>
                      <div className="text-center">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent-green mx-auto mb-1" />
                        <p className="text-gray-400 text-[10px] sm:text-xs">نموذج</p>
                        <p className="text-sm sm:text-base md:text-lg font-bold text-accent-green">
                          {leaderboard[2]?.forms_submitted}
                        </p>
                      </div>
                    </div>
                    {leaderboard[2]?.current_title && (
                      <div className="mt-1 sm:mt-2 text-center">
                        <span className="text-[10px] sm:text-xs bg-amber-600/50 text-amber-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full truncate inline-block max-w-full">
                          🏅 {leaderboard[2].current_title}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 sm:mt-3 text-lg sm:text-xl md:text-2xl font-bold text-secondary">
                      {leaderboard[2]?.combined_score} نقطة
                    </div>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Rest of Leaderboard */}
          <Card>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              القائمة الكاملة
            </h2>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 animate-spin">⏳</div>
                <p className="text-xl text-gray-400">جاري التحميل...</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">لا يوجد متسابقون</h3>
                <p className="text-gray-400">ابدأ القراءة لتظهر في جدول الترتيب!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {leaderboard.map((entry, index) => (
                  <motion.div
                    key={entry.student_id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-lg transition-all hover:scale-105 ${
                      index === 0
                        ? 'bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border-2 border-yellow-500/50 shadow-xl shadow-yellow-500/20'
                        : index < 3
                        ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-yellow-500/30 shadow-lg'
                        : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-600'
                    }`}
                  >
                    {/* Rank and Icon */}
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${getRankBadgeClass(entry, index)}`}
                      >
                        {entry.rank}
                      </div>
                      <div className="flex-shrink-0">{getRankIcon(index, entry.current_title)}</div>
                    </div>

                    {/* Name and Achievement Badge */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-white">{entry.name}</h3>
                        {index === 0 && (
                          <span className="text-lg animate-pulse">👑</span>
                        )}
                      </div>
                      {entry.current_title && (
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                          index === 0 
                            ? 'bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border border-yellow-400/50' 
                            : 'bg-gradient-to-r from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30'
                        }`}>
                          <span className="text-lg">{index === 0 ? '👑' : '🏅'}</span>
                          <span className={`text-sm font-semibold ${index === 0 ? 'text-yellow-200' : 'text-yellow-400'}`}>
                            {entry.current_title}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-sm text-gray-300">القصص</span>
                        </div>
                        <span className="text-lg font-bold text-white">{entry.stories_read}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-accent-green" />
                          <span className="text-sm text-gray-300">النماذج</span>
                        </div>
                        <span className="text-lg font-bold text-white">{entry.forms_submitted}</span>
                      </div>
                      {entry.avg_grade && entry.graded_submissions && (
                        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-600/20 to-purple-700/20 border border-purple-500/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-gray-300">المعدل</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-purple-400">{Math.round(entry.avg_grade)}%</span>
                            <span className="text-xs text-gray-400 block">({entry.graded_submissions} تقييم)</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-secondary" />
                          <span className="text-sm font-semibold text-gray-200">المجموع</span>
                        </div>
                        <span className="text-xl font-bold text-secondary">{entry.combined_score}</span>
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="mt-4">
                      <Button
                        onClick={() => showStudentDetails(entry)}
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        icon={<Eye className="w-4 h-4" />}
                      >
                        عرض التفاصيل
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <Card className="bg-gradient-to-r from-primary/20 to-secondary/20 text-center py-6">
              <h3 className="text-xl font-bold text-white mb-2">كيف يتم الحساب؟</h3>
              <p className="text-gray-200 font-semibold">
                النقاط = (عدد القصص × 2) + عدد النماذج
              </p>
            </Card>
          </motion.div>
        </motion.div>

        {/* Student Details Modal */}
        {showDetails && selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeStudentDetails}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  {getRankIcon(Math.max(selectedStudent.rank - 1, 0), selectedStudent.current_title)}
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedStudent.name}</h2>
                    <p className="text-gray-400">المركز #{selectedStudent.rank}</p>
                  </div>
                </div>
                <Button
                  onClick={closeStudentDetails}
                  variant="ghost"
                  size="sm"
                  icon={<X className="w-5 h-5" />}
                />
              </div>

              {/* Student Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Achievement Card */}
                <Card className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border-yellow-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Award className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-lg font-bold text-white">الإنجاز الحالي</h3>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl mb-2">🏅</div>
                    <p className="text-xl font-bold text-yellow-400">{selectedStudent.current_title || 'قارئ مبتدئ'}</p>
                    <p className="text-sm text-gray-400 mt-1">اللقب الحالي</p>
                  </div>
                </Card>

                {/* Grade Card */}
                <Card className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 border-blue-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <BookOpen className="w-6 h-6 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">الصف الدراسي</h3>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-400 mb-2">{selectedStudent.grade || 'غير محدد'}</div>
                    <p className="text-sm text-gray-400">الصف</p>
                  </div>
                </Card>
              </div>

              {/* Detailed Statistics */}
              <Card className="mb-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  الإحصائيات التفصيلية
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stories Read */}
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <BookOpen className="w-8 h-8 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white mb-1">{selectedStudent.stories_read}</div>
                    <p className="text-sm text-gray-400">قصة مقروءة</p>
                    <div className="mt-2 text-xs text-primary font-semibold">
                      {selectedStudent.stories_read * 2} نقطة
                    </div>
                  </div>

                  {/* Forms Submitted */}
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <FileText className="w-8 h-8 text-accent-green mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white mb-1">{selectedStudent.forms_submitted}</div>
                    <p className="text-sm text-gray-400">نموذج مقدم</p>
                    <div className="mt-2 text-xs text-accent-green font-semibold">
                      {selectedStudent.forms_submitted} نقطة
                    </div>
                  </div>

                  {/* Average Grade */}
                  {selectedStudent.avg_grade && selectedStudent.graded_submissions && (
                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 rounded-lg p-4 text-center border border-purple-500/30">
                      <Award className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white mb-1">{Math.round(selectedStudent.avg_grade)}%</div>
                      <p className="text-sm text-gray-400">المعدل العام</p>
                      <div className="mt-2 text-xs text-purple-400 font-semibold">
                        {selectedStudent.graded_submissions} تقييم
                      </div>
                    </div>
                  )}

                  {/* Grade Info */}
                  {selectedStudent.avg_grade && (
                    <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-gray-300 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-5 h-5 text-blue-400" />
                        <span className="font-semibold text-white">ملاحظة عن التقييم:</span>
                      </div>
                      <p className="text-xs">
                        يشمل تقييم النموذج (الإجابات المكتوبة) والتقييم الصوتي (قراءة الطالب)
                      </p>
                    </div>
                  )}

                  {/* Total Score */}
                  <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg p-4 text-center border border-primary/30">
                    <Trophy className="w-8 h-8 text-secondary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white mb-1">{selectedStudent.combined_score}</div>
                    <p className="text-sm text-gray-400">المجموع الكلي</p>
                    <div className="mt-2 text-xs text-secondary font-semibold">
                      النقاط الإجمالية
                    </div>
                  </div>
                </div>
              </Card>

              {/* Progress Visualization */}
              <Card>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-accent-green" />
                  تقدم الطالب
                </h3>
                
                <div className="space-y-4">
                  {/* Stories Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-300">القصص المقروءة</span>
                      <span className="text-sm text-primary font-bold">{selectedStudent.stories_read}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-primary to-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((selectedStudent.stories_read / 25) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">هدف: 25 قصة</p>
                  </div>

                  {/* Forms Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-300">النماذج المقدمة</span>
                      <span className="text-sm text-accent-green font-bold">{selectedStudent.forms_submitted}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-accent-green to-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((selectedStudent.forms_submitted / 20) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">هدف: 20 نموذج</p>
                  </div>
                </div>
              </Card>

              {/* Close Button */}
              <div className="mt-6 text-center">
                <Button
                  onClick={closeStudentDetails}
                  variant="primary"
                  size="lg"
                  className="px-8"
                >
                  إغلاق
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatedBackground>
  )
}

