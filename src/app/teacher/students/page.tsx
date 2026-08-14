'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import LoadingState from '@/components/LoadingState'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { BookOpen, ClipboardList, Copy, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react'

interface Student {
  id: string
  name: string
  access_code: string
  classroom_id: string
  stories_read: number
  forms_submitted: number
  is_registered: boolean
  created_at: string
}

export default function StudentManagement() {
  const router = useRouter()
  const { user, userRole, hydrated } = useAppStore()
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
  const [editedCode, setEditedCode] = useState('')
  const [isUpdatingCode, setIsUpdatingCode] = useState(false)
  const [showAddByCodeModal, setShowAddByCodeModal] = useState(false)
  const [addByCodeValue, setAddByCodeValue] = useState('')
  const [isAddingByCode, setIsAddingByCode] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (userRole !== 'teacher') {
      router.push('/')
      return
    }
    loadStudents()
  }, [hydrated, userRole, router])

  const loadStudents = async () => {
    try {
      setIsLoading(true)
      const teacherData = user as any
      
      // Use the new teacher_get_students function
      const { data, error } = await supabase.rpc('teacher_get_students', {
        teacher_access_code: teacherData.access_code
      })

      if (error) {
        console.error('Error loading students:', error)
        toast.error(`فشل تحميل الطلاب: ${error.message}`)
        return
      }

      setStudents(data || [])
    } catch (error) {
      console.error('Error loading students:', error)
      toast.error('فشل تحميل الطلاب')
    } finally {
      setIsLoading(false)
    }
  }

  const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const createStudent = async () => {
    if (!newStudentName.trim()) {
      toast.error('الرجاء إدخال اسم الطالب')
      return
    }

    try {
      setIsCreating(true)
      const teacherData = user as any
      
      const accessCode = generateAccessCode()

      // Use the new teacher_create_student function
      const { data, error } = await supabase.rpc('teacher_create_student', {
        student_name: newStudentName,
        student_access_code: accessCode,
        teacher_access_code: teacherData.access_code
      })

      if (error) {
        console.error('Error creating student:', error)
        toast.error(`فشل إنشاء الطالب: ${error.message}`)
        return
      }

      toast.success('تم إنشاء الطالب بنجاح!')
      setNewStudentName('')
      setShowCreateModal(false)
      loadStudents()
    } catch (error) {
      console.error('Error creating student:', error)
      toast.error('فشل إنشاء الطالب')
    } finally {
      setIsCreating(false)
    }
  }

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('تم نسخ رمز الوصول!')
  }

  const deleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${studentName}"؟`)) return

    try {
      const teacherData = user as any
      
      const { data, error } = await supabase.rpc('teacher_delete_student', {
        teacher_access_code: teacherData.access_code,
        student_id: studentId
      })

      if (error) {
        console.error('Error deleting student:', error)
        toast.error(`فشل حذف الطالب: ${error.message}`)
        return
      }

      toast.success('تم حذف الطالب بنجاح')
      loadStudents()
    } catch (error: any) {
      console.error('Error deleting student:', error)
      toast.error(`فشل حذف الطالب: ${error.message}`)
    }
  }

  const startEditingCode = (studentId: string, currentCode: string) => {
    setEditingCodeId(studentId)
    setEditedCode(currentCode)
  }

  const cancelEditingCode = () => {
    setEditingCodeId(null)
    setEditedCode('')
  }

  const addStudentByCode = async () => {
    const code = addByCodeValue?.trim()
    if (!code) {
      toast.error('الرجاء إدخال رمز الطالب')
      return
    }
    try {
      setIsAddingByCode(true)
      const teacherData = user as any
      const { error } = await supabase.rpc('teacher_add_student_to_class', {
        teacher_access_code: teacherData.access_code,
        student_access_code: code
      })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('لم يتم العثور') || msg.includes('not found')) toast.error('لم يتم العثور على طالب بهذا الرمز')
        else if (msg.includes('Already') || msg.includes('already') || msg.includes('في فصلك')) toast.error('الطالب مسجّل بالفعل في فصلك')
        else if (msg.includes('صلاحية') || msg.includes('permission')) toast.error('ليس لديك صلاحية لإضافة طلاب')
        else if (msg.includes('لا يوجد فصل')) toast.error('لا يوجد فصل لهذا المعلم. يرجى إنشاء فصل أولاً')
        else toast.error(msg || 'فشل إضافة الطالب')
        return
      }
      toast.success('تمت إضافة الطالب إلى فصلك')
      setAddByCodeValue('')
      setShowAddByCodeModal(false)
      loadStudents()
    } catch (e: any) {
      toast.error(e?.message || 'فشل إضافة الطالب')
    } finally {
      setIsAddingByCode(false)
    }
  }

  const updateAccessCode = async (studentId: string) => {
    if (!editedCode.trim()) {
      toast.error('الرجاء إدخال رمز وصول')
      return
    }

    // Validate code format (only letters and numbers)
    const codeRegex = /^[A-Z0-9]+$/
    if (!codeRegex.test(editedCode)) {
      toast.error('رمز الوصول يجب أن يحتوي على أحرف إنجليزية كبيرة وأرقام فقط')
      return
    }

    if (editedCode.length < 4) {
      toast.error('رمز الوصول يجب أن يكون 4 أحرف على الأقل')
      return
    }

    try {
      setIsUpdatingCode(true)
      const teacherData = user as any

      // Use the new RPC function for secure update
      const { data, error } = await supabase.rpc('teacher_update_student_code', {
        teacher_access_code: teacherData.access_code,
        student_id: studentId,
        new_access_code: editedCode
      })

      if (error) {
        console.error('Error updating access code:', error)
        toast.error(`فشل تحديث رمز الوصول: ${error.message}`)
        return
      }

      toast.success('تم تحديث رمز الوصول بنجاح!')
      setEditingCodeId(null)
      setEditedCode('')
      loadStudents()
    } catch (error: any) {
      console.error('Error updating access code:', error)
      toast.error(`فشل تحديث رمز الوصول: ${error.message}`)
    } finally {
      setIsUpdatingCode(false)
    }
  }

  return (
    <AnimatedBackground>
      <Toaster position="top-center" />
      <div className="page-container min-h-screen" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-ink mb-2">
                إدارة الطلاب
              </h1>
              <p className="text-slate-500 text-sm md:text-lg">إنشاء وإدارة حسابات الطلاب</p>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="primary"
                size="sm"
                className="flex-1 md:flex-none"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">إضافة طالب</span>
                <span className="md:hidden">إضافة</span>
              </Button>
              <Button
                onClick={() => setShowAddByCodeModal(true)}
                variant="secondary"
                size="sm"
                className="flex-1 md:flex-none"
              >
                <span className="hidden md:inline">إضافة طالب موجود</span>
                <span className="md:hidden">رمز طالب</span>
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
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Users className="h-6 w-6" aria-hidden="true" /></div>
              <p className="text-slate-500 text-sm mb-1">عدد الطلاب</p>
              <p className="text-3xl font-bold text-primary">{students.length}</p>
            </Card>
            <Card className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><BookOpen className="h-6 w-6" aria-hidden="true" /></div>
              <p className="text-slate-500 text-sm mb-1">مجموع القراءات</p>
              <p className="text-3xl font-bold text-accent-green">
                {students.reduce((sum, s) => sum + s.stories_read, 0)}
              </p>
            </Card>
            <Card className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-50 text-secondary-700"><ClipboardList className="h-6 w-6" aria-hidden="true" /></div>
              <p className="text-slate-500 text-sm mb-1">مجموع النماذج</p>
              <p className="text-3xl font-bold text-secondary">
                {students.reduce((sum, s) => sum + s.forms_submitted, 0)}
              </p>
            </Card>
          </div>

          {/* Students List */}
          {isLoading ? (
            <Card><LoadingState /></Card>
          ) : students.length === 0 ? (
            <Card className="text-center py-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><UserPlus className="h-8 w-8" aria-hidden="true" /></div>
              <h3 className="text-2xl font-bold text-ink mb-2">لا يوجد طلاب</h3>
              <p className="text-slate-500 mb-4">ابدأ بإضافة طلاب جدد</p>
              <Button onClick={() => setShowCreateModal(true)} size="lg">
                إضافة أول طالب
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student, index) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-xl font-bold text-ink mb-1 truncate">
                          {student.name}
                        </h3>
                        <p className="text-xs md:text-sm text-slate-500">
                          انضم: {new Date(student.created_at).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Users className="h-5 w-5" aria-hidden="true" /></div>
                    </div>

                    {/* Access Code */}
                    <div className="bg-white p-2 md:p-3 rounded-lg mb-3 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">رمز الوصول</p>
                      {editingCodeId === student.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editedCode}
                            onChange={(e) => setEditedCode(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 text-sm md:text-base font-mono border border-slate-200 rounded bg-white text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="أدخل رمز جديد"
                            disabled={isUpdatingCode}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateAccessCode(student.id)}
                              disabled={isUpdatingCode}
                              className="flex-1 px-3 py-1.5 bg-primary text-ink rounded text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdatingCode ? 'جاري الحفظ...' : 'حفظ'}
                            </button>
                            <button
                              onClick={cancelEditingCode}
                              disabled={isUpdatingCode}
                              className="flex-1 px-3 py-1.5 bg-slate-50 text-ink rounded text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <code dir="ltr" className="flex-1 truncate text-start font-mono text-sm text-primary md:text-lg">
                            {student.access_code}
                          </code>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => startEditingCode(student.id, student.access_code)}
                              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-ink"
                              aria-label="تعديل الرمز"
                              title="تعديل الرمز"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => copyAccessCode(student.access_code)}
                              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-ink"
                              aria-label="نسخ الرمز"
                              title="نسخ الرمز"
                            >
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3">
                      <div className="text-center">
                        <p className="text-xl md:text-2xl font-bold text-primary">
                          {student.stories_read}
                        </p>
                        <p className="text-xs text-slate-500">قصة</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl md:text-2xl font-bold text-accent-green">
                          {student.forms_submitted}
                        </p>
                        <p className="text-xs text-slate-500">نموذج</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => router.push(`/teacher/students/${student.id}`)}
                        size="sm"
                        variant="primary"
                        className="flex-1 text-xs md:text-sm"
                      >
                        عرض
                      </Button>
                      <Button
                        onClick={() => deleteStudent(student.id, student.name)}
                        size="sm"
                        variant="danger"
                        className="text-xs md:text-sm"
                        icon={<Trash2 className="h-4 w-4" />}
                        aria-label={`حذف الطالب ${student.name}`}
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

        {/* Create Student Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="dialog-backdrop"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <h2 className="text-2xl font-bold text-ink mb-4">إضافة طالب جديد</h2>
                
                <div className="mb-4">
                  <label className="block text-ink font-bold mb-2">
                    اسم الطالب
                  </label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="مثال: محمد أحمد"
                    className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink"
                    disabled={isCreating}
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    سيتم إنشاء رمز وصول تلقائياً
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={createStudent}
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    isLoading={isCreating}
                    disabled={isCreating}
                  >
                    {isCreating ? 'جاري الإنشاء...' : 'إنشاء'}
                  </Button>
                  <Button
                    onClick={() => setShowCreateModal(false)}
                    variant="ghost"
                    size="lg"
                    disabled={isCreating}
                  >
                    إلغاء
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {/* Add existing student by code modal */}
        {showAddByCodeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="dialog-backdrop"
            onClick={() => !isAddingByCode && setShowAddByCodeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card>
                <h2 className="text-2xl font-bold text-ink mb-4">إضافة طالب موجود</h2>
                <p className="text-slate-500 text-sm mb-4">
                  أدخل رمز الطالب الذي أنشأه معلم آخر. سيظهر في قائمة فصلك بنفس الرمز.
                </p>
                <div className="mb-4">
                  <label className="block text-ink font-bold mb-2">رمز الطالب</label>
                  <input
                    type="text"
                    value={addByCodeValue}
                    onChange={(e) => setAddByCodeValue(e.target.value.trim().toUpperCase())}
                    placeholder="مثال: ABC12XYZ"
                    className="w-full px-4 py-3 text-lg font-mono border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary bg-white text-ink"
                    disabled={isAddingByCode}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={addStudentByCode}
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    disabled={isAddingByCode || !addByCodeValue.trim()}
                  >
                    {isAddingByCode ? 'جاري الإضافة...' : 'إضافة إلى فصلي'}
                  </Button>
                  <Button
                    onClick={() => !isAddingByCode && setShowAddByCodeModal(false)}
                    variant="ghost"
                    size="lg"
                    disabled={isAddingByCode}
                  >
                    إلغاء
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatedBackground>
  )
}

