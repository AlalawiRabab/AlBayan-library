'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { adminService, supabase } from '@/lib/supabase'
import { validateClassroomName } from '@/lib/classroomName'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Dialog from '@/components/Dialog'
import toast from 'react-hot-toast'
import { 
  Plus, 
  Trash2, 
  Edit, 
  GraduationCap, 
  Users, 
  BookOpen,
  Save,
  X,
  Award,
  FileText
} from 'lucide-react'

interface Grade {
  id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
}

interface GradeStats {
  grade: number
  teachers_count: number
  students_count: number
  stories_count: number
}

interface Classroom {
  id: string
  name: string
  grade: number
  is_active: boolean
  created_at: string
}

interface Submission {
  id: string
  student_name: string
  student_access_code: string
  story_title: string
  form_title: string
  grade?: number
  voice_grade?: number
  submitted_at: string
  feedback?: string
}

export default function GradeManagement() {
  const router = useRouter()
  const { user, userRole, hydrated } = useAppStore()
  const [grades, setGrades] = useState<Grade[]>([])
  const [gradeStats, setGradeStats] = useState<GradeStats[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [nameEditClassroom, setNameEditClassroom] = useState<Classroom | null>(null)
  const [editingClassroomName, setEditingClassroomName] = useState('')
  const [classroomNameError, setClassroomNameError] = useState('')
  const [isSavingClassroomName, setIsSavingClassroomName] = useState(false)
  const [newGrade, setNewGrade] = useState({
    name: ''
  })

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'admin') {
      router.push('/')
      return
    }
    loadGrades()
  }, [hydrated, userRole, router])

  const loadGrades = async () => {
    try {
      setIsLoading(true)

      if (!user || !('access_code' in user)) {
        throw new Error('Admin access code is unavailable')
      }

      const overviewResponse = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAccessCode: user.access_code,
          resource: 'overview'
        })
      })

      const overview = await overviewResponse.json()
      if (!overviewResponse.ok) {
        throw new Error(overview.error || 'Failed to load admin overview')
      }

      setClassrooms(overview.classrooms || [])
      setGradeStats(overview.stats || [])
      setSubmissions(overview.submissions || [])
      
      // Load grades from database
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('*')
        .order('id')

      console.log('Grades loaded from DB:', gradesData)

      if (!gradesError && gradesData) {
        setGrades(gradesData)
      } else {
        console.error('Error loading grades:', gradesError)
      }
    } catch (error) {
      console.error('Error loading grades:', error)
      toast.error('فشل تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const updateGradeName = async (gradeId: number, newName: string) => {
    if (!newName.trim()) {
      toast.error('الرجاء إدخال اسم')
      return
    }

    try {
      if (!user || !('access_code' in user)) throw new Error('Admin access code is unavailable')
      const response = await fetch('/api/admin/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAccessCode: (user as any).access_code,
          operation: 'update_name',
          gradeId,
          name: newName
        })
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update grade')

      toast.success('تم تحديث اسم الصف بنجاح! ')
      setEditingGrade(null)
      loadGrades()
    } catch (error: any) {
      console.error('Error updating grade:', error)
      toast.error('فشل تحديث اسم الصف')
    }
  }

  const openClassroomNameEdit = (classroom: Classroom) => {
    if (userRole !== 'admin') {
      toast.error('غير مصرح')
      return
    }
    setNameEditClassroom(classroom)
    setEditingClassroomName(classroom.name || '')
    setClassroomNameError('')
  }

  const closeClassroomNameEdit = (open: boolean) => {
    if (!open) {
      setNameEditClassroom(null)
      setEditingClassroomName('')
      setClassroomNameError('')
    }
  }

  const saveClassroomName = async () => {
    if (!nameEditClassroom) return
    if (userRole !== 'admin') {
      toast.error('غير مصرح')
      return
    }

    const validated = validateClassroomName(editingClassroomName)
    if (!validated.ok) {
      setClassroomNameError(validated.error)
      toast.error(validated.error)
      return
    }

    const confirmed = window.confirm(
      'هل تريدين تعديل اسم الصف المعروض فقط؟ لن يتغير رقم الصف أو روابط المعلمات والطالبات والقصص.'
    )
    if (!confirmed) return

    try {
      setIsSavingClassroomName(true)
      setClassroomNameError('')
      await adminService.updateClassroomName(nameEditClassroom.id, validated.name)
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === nameEditClassroom.id ? { ...c, name: validated.name } : c
        )
      )
      toast.success('تم تعديل اسم الصف بنجاح')
      setNameEditClassroom(null)
      setEditingClassroomName('')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل تحديث الاسم'
      toast.error(message)
    } finally {
      setIsSavingClassroomName(false)
    }
  }

  const deleteGrade = async (gradeId: number, gradeName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الصف "${gradeName}"؟\nسيتم حذف جميع البيانات المرتبطة بهذا الصف.`)) {
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
          gradeId
        })
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete grade')

      toast.success('تم حذف الصف بنجاح!')
      loadGrades()
    } catch (error: any) {
      console.error('Error deleting grade:', error)
      toast.error('فشل حذف الصف')
    }
  }

  const toggleGradeStatus = async (gradeId: number, isActive: boolean) => {
    try {
      if (!user || !('access_code' in user)) throw new Error('Admin access code is unavailable')
      const response = await fetch('/api/admin/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAccessCode: (user as any).access_code,
          operation: 'toggle_status',
          gradeId,
          isActive
        })
      })
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update grade status')

      toast.success(`تم ${!isActive ? 'تفعيل' : 'إلغاء تفعيل'} الصف بنجاح!`)
      loadGrades()
    } catch (error: any) {
      console.error('Error toggling grade status:', error)
      toast.error('فشل تحديث حالة الصف')
    }
  }

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-ink mb-4">غير مصرح لك بالوصول</h2>
          <p className="text-slate-600 mb-6">هذه الصفحة متاحة للمسؤولين فقط</p>
          <Button onClick={() => router.push('/')} variant="primary">
            العودة للرئيسية
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ink mb-2">إدارة الصفوف الدراسية</h1>
            <p className="text-slate-600">إدارة الصفوف والمعلمين والطلاب</p>
          </div>
          <Button
            onClick={() => router.push('/admin')}
            variant="ghost"
            size="md"
          >
            العودة للرئيسية
          </Button>
        </div>

        {/* Grades List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-slate-600 mt-4">جاري تحميل الصفوف...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grades.map((grade, index) => {
              const stats = gradeStats.find(s => s.grade === grade.id)
              
              return (
                <motion.div
                  key={grade.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card className="p-4 transition-shadow duration-200 hover:shadow-hover md:p-6">
                    <div className="flex justify-between items-start mb-4" onClick={() => editingGrade?.id !== grade.id && router.push(`/admin/grades/${grade.id}`)}>
                      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-primary flex-shrink-0" />
                        {editingGrade?.id === grade.id ? (
                          <input
                            type="text"
                            defaultValue={grade.name}
                            onBlur={(e) => {
                              if (e.target.value !== grade.name) {
                                updateGradeName(grade.id, e.target.value)
                              } else {
                                setEditingGrade(null)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setEditingGrade(null)
                              } else if (e.key === 'Enter') {
                                const newName = e.currentTarget.value
                                if (newName !== grade.name) {
                                  updateGradeName(grade.id, newName)
                                } else {
                                  setEditingGrade(null)
                                }
                              }
                            }}
                            autoFocus
                            className="bg-slate-50 text-ink font-bold px-2 py-1 rounded border-2 border-primary focus:outline-none text-sm md:text-base min-w-0 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base md:text-xl font-bold text-ink truncate">{grade.name}</h3>
                            <p className="text-slate-600 text-xs md:text-sm truncate">{grade.description}</p>
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs md:text-sm font-bold flex-shrink-0 ${
                        grade.is_active
                          ? 'bg-accent-green text-ink'
                          : 'bg-accent-red text-ink'
                      }`}>
                        {grade.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                      {editingGrade?.id === grade.id ? (
                        <>
                          <Button
                            onClick={() => setEditingGrade(null)}
                            variant="ghost"
                            size="sm"
                            className="flex-1 md:flex-none"
                            icon={<X className="w-3 h-3 md:w-4 md:h-4" />}
                          >
                            إلغاء
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => setEditingGrade(grade)}
                            variant="ghost"
                            size="sm"
                            className="flex-1 md:flex-none"
                            icon={<Edit className="w-3 h-3 md:w-4 md:h-4" />}
                          >
                            <span className="hidden md:inline">تعديل الاسم</span>
                            <span className="md:hidden">تعديل</span>
                          </Button>
                          <Button
                            onClick={() => deleteGrade(grade.id, grade.name)}
                            variant="ghost"
                            size="sm"
                            className="flex-1 md:flex-none"
                            icon={<Trash2 className="w-3 h-3 md:w-4 md:h-4" />}
                          >
                            حذف
                          </Button>
                          <Button
                            onClick={() => toggleGradeStatus(grade.id, grade.is_active)}
                            variant="ghost"
                            size="sm"
                            className="flex-1 md:flex-none"
                          >
                            <span className="hidden md:inline">{grade.is_active ? 'إلغاء التفعيل' : 'تفعيل'}</span>
                            <span className="md:hidden">{grade.is_active ? 'إلغاء' : 'تفعيل'}</span>
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
                      <div className="text-center">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-secondary mx-auto mb-1 md:mb-2" />
                        <div className="text-base md:text-lg font-bold text-ink">{stats?.teachers_count || 0}</div>
                        <div className="text-xs text-slate-500">معلم</div>
                      </div>
                      <div className="text-center">
                        <Users className="w-5 h-5 md:w-6 md:h-6 text-accent-green mx-auto mb-1 md:mb-2" />
                        <div className="text-base md:text-lg font-bold text-ink">{stats?.students_count || 0}</div>
                        <div className="text-xs text-slate-500">طالب</div>
                      </div>
                      <div className="text-center">
                        <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-accent-red mx-auto mb-1 md:mb-2" />
                        <div className="text-base md:text-lg font-bold text-ink">{stats?.stories_count || 0}</div>
                        <div className="text-xs text-slate-500">قصة</div>
                      </div>
                    </div>

                    {/* View Info */}
                    <div className="pt-4 border-t border-slate-200">
                      <Button
                        onClick={() => router.push(`/admin/grades/${grade.id}`)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        عرض التفاصيل
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}

        {grades.length === 0 && !isLoading && (
          <Card className="p-12 text-center">
            <GraduationCap className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-ink mb-2">لا توجد صفوف بعد</h3>
            <p className="text-slate-600 mb-6">ابدأ بإنشاء صف جديد لإدارة المعلمين والطلاب</p>
            <Button
              onClick={() => setShowCreateForm(true)}
              variant="primary"
              size="lg"
              icon={<Plus className="w-5 h-5" />}
            >
              إضافة صف جديد
            </Button>
          </Card>
        )}

        {/* Registered Classes Section */}
        {classrooms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12"
          >
            <Card className="p-4 md:p-8">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-primary flex-shrink-0" />
                <div>
                  <h2 className="text-xl md:text-3xl font-bold text-ink">جميع الصفوف المسجلة</h2>
                  <p className="text-slate-600 text-sm md:text-base">عرض جميع الصفوف الدراسية المسجلة في النظام</p>
                </div>
              </div>

              {/* Classrooms Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-start py-3 px-2 md:py-4 md:px-4 text-xs md:text-sm font-bold text-slate-600">الصف</th>
                      <th className="text-start py-3 px-2 md:py-4 md:px-4 text-xs md:text-sm font-bold text-slate-600 hidden md:table-cell">الاسم</th>
                      <th className="text-start py-3 px-2 md:py-4 md:px-4 text-xs md:text-sm font-bold text-slate-600 hidden lg:table-cell">الوصف</th>
                      <th className="text-start py-3 px-2 md:py-4 md:px-4 text-xs md:text-sm font-bold text-slate-600">الحالة</th>
                      <th className="text-start py-3 px-2 md:py-4 md:px-4 text-xs md:text-sm font-bold text-slate-600 hidden md:table-cell">تاريخ الإنشاء</th>
                      <th className="text-start py-3 px-2 md:py-4 md:px-4 text-xs md:text-sm font-bold text-slate-600">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classrooms.map((classroom, index) => (
                      <motion.tr
                        key={classroom.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-slate-200 hover:bg-white transition-colors"
                      >
                        <td className="py-3 px-2 md:py-4 md:px-4 font-bold text-ink text-xs md:text-sm">
                          الصف {classroom.grade}
                        </td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-slate-600 hidden md:table-cell text-xs md:text-sm">{classroom.name}</td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-slate-600 hidden lg:table-cell text-xs md:text-sm">-</td>
                        <td className="py-3 px-2 md:py-4 md:px-4">
                          <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-bold ${
                            classroom.is_active
                              ? 'bg-accent-green text-ink'
                              : 'bg-accent-red text-ink'
                          }`}>
                            {classroom.is_active ? 'نشط' : 'غير نشط'}
                          </span>
                        </td>
                        <td className="py-3 px-2 md:py-4 md:px-4 text-slate-500 text-xs md:text-sm hidden md:table-cell">
                          {new Date(classroom.created_at).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-3 px-2 md:py-4 md:px-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openClassroomNameEdit(classroom)}
                            icon={<Edit className="w-4 h-4" />}
                            title="تعديل اسم الصف"
                          >
                            تعديل اسم الصف
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Submissions Section */}
        {submissions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12"
          >
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Award className="w-8 h-8 text-primary" />
                <div>
                  <h2 className="text-3xl font-bold text-ink">جميع التقييمات المسجلة</h2>
                  <p className="text-slate-600">عرض جميع إجابات الطلاب وتقييماتهم</p>
                </div>
              </div>

              {/* Submissions Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-start py-4 px-4 text-sm font-bold text-slate-600">الطالب</th>
                      <th className="text-start py-4 px-4 text-sm font-bold text-slate-600">القصة</th>
                      <th className="text-start py-4 px-4 text-sm font-bold text-slate-600">النموذج</th>
                      <th className="text-start py-4 px-4 text-sm font-bold text-slate-600">تقييم النموذج</th>
                      <th className="text-start py-4 px-4 text-sm font-bold text-slate-600">تقييم الصوت</th>
                      <th className="text-start py-4 px-4 text-sm font-bold text-slate-600">المعدل النهائي</th>
                      <th className="text-start py-4 px-4 text-sm font-bold text-slate-600">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission, index) => {
                      const finalGrade = submission.grade !== null && submission.grade !== undefined && 
                                         submission.voice_grade !== null && submission.voice_grade !== undefined
                                         ? Math.round((submission.grade + submission.voice_grade) / 2)
                                         : submission.grade ?? submission.voice_grade ?? null

                      return (
                        <motion.tr
                          key={submission.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-slate-200 hover:bg-white transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="font-bold text-ink">{submission.student_name}</div>
                            <div dir="ltr" className="text-start font-mono text-xs text-slate-500">{submission.student_access_code}</div>
                          </td>
                          <td className="py-4 px-4 text-slate-600">{submission.story_title}</td>
                          <td className="py-4 px-4 text-slate-600">{submission.form_title}</td>
                          <td className="py-4 px-4">
                            {submission.grade !== null && submission.grade !== undefined ? (
                              <span className="text-primary-700 font-bold">{submission.grade}/100</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {submission.voice_grade !== null && submission.voice_grade !== undefined ? (
                              <span className="text-secondary-700 font-bold">{submission.voice_grade}/100</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {finalGrade !== null ? (
                              <span className={`font-bold ${
                                finalGrade >= 90 ? 'text-emerald-700' :
                                finalGrade >= 70 ? 'text-primary-700' :
                                finalGrade >= 50 ? 'text-amber-700' : 'text-rose-700'
                              }`}>
                                {finalGrade}/100
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-500 text-sm">
                            {new Date(submission.submitted_at).toLocaleDateString('ar-SA')}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      <Dialog
        open={!!nameEditClassroom}
        onOpenChange={closeClassroomNameEdit}
        title="تعديل اسم الصف"
        description="يُحدَّث الاسم المعروض فقط. لن يتغير رقم الصف أو روابط المعلمات والطالبات والقصص."
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => closeClassroomNameEdit(false)}
              disabled={isSavingClassroomName}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={saveClassroomName}
              isLoading={isSavingClassroomName}
              disabled={isSavingClassroomName}
            >
              حفظ
            </Button>
          </>
        }
      >
        {nameEditClassroom && (
          <div className="space-y-4" dir="rtl">
            <div>
              <label className="block text-slate-600 font-semibold mb-2">الصف الرقمي</label>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-ink">
                الصف {nameEditClassroom.grade}
              </p>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-2">الاسم الحالي</label>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-ink">
                {nameEditClassroom.name}
              </p>
            </div>
            <div>
              <label htmlFor="classroom-new-name" className="block text-slate-600 font-semibold mb-2">
                الاسم الجديد
              </label>
              <input
                id="classroom-new-name"
                type="text"
                value={editingClassroomName}
                onChange={(e) => {
                  setEditingClassroomName(e.target.value)
                  setClassroomNameError('')
                }}
                maxLength={100}
                disabled={isSavingClassroomName}
                className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 font-semibold text-ink focus:outline-none focus:ring-4 focus:ring-primary"
                placeholder="أدخلي الاسم الجديد"
                dir="rtl"
                autoComplete="off"
              />
              {classroomNameError ? (
                <p className="mt-2 text-sm font-semibold text-rose-600">{classroomNameError}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">بين 2 و100 محرفًا. يُسمح بالأسماء العربية والمسافات.</p>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
