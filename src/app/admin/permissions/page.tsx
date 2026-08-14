'use client'

import React, { useState, useEffect } from 'react'

export const dynamic = 'force-dynamic'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import LoadingState from '@/components/LoadingState'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { 
  Shield, 
  ArrowRight,
  Save,
  Eye,
  Edit,
  Trash2,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Settings
} from 'lucide-react'

interface Permission {
  id: string
  name: string
  description: string
  category: string
  is_enabled: boolean
}

interface TeacherPermission {
  teacher_id: string
  teacher_name: string
  permission_level: string
  permissions: Permission[]
}

const PERMISSION_CATEGORIES = {
  content: {
    name: 'إدارة المحتوى',
    icon: '',
    permissions: [
      { name: 'create_stories', description: 'إنشاء قصص جديدة' },
      { name: 'edit_stories', description: 'تعديل القصص الموجودة' },
      { name: 'delete_stories', description: 'حذف القصص' },
      { name: 'create_forms', description: 'إنشاء نماذج تحليل' },
      { name: 'edit_forms', description: 'تعديل النماذج' },
      { name: 'delete_forms', description: 'حذف النماذج' },
    ]
  },
  students: {
    name: 'إدارة الطلاب',
    icon: '',
    permissions: [
      { name: 'create_students', description: 'إنشاء حسابات طلاب' },
      { name: 'view_students', description: 'عرض قائمة الطلاب' },
      { name: 'edit_students', description: 'تعديل بيانات الطلاب' },
      { name: 'delete_students', description: 'حذف حسابات الطلاب' },
    ]
  },
  grading: {
    name: 'التقييم والدرجات',
    icon: '⭐',
    permissions: [
      { name: 'grade_submissions', description: 'تقييم إجابات الطلاب' },
      { name: 'view_grades', description: 'عرض الدرجات' },
      { name: 'edit_grades', description: 'تعديل الدرجات' },
      { name: 'delete_grades', description: 'حذف الدرجات' },
    ]
  },
  analytics: {
    name: 'التحليلات والتقارير',
    icon: '',
    permissions: [
      { name: 'view_analytics', description: 'عرض التحليلات' },
      { name: 'export_data', description: 'تصدير البيانات' },
      { name: 'view_reports', description: 'عرض التقارير' },
    ]
  }
}

const PERMISSION_LEVELS = {
  full_access: {
    name: 'صلاحية كاملة',
    description: 'جميع الصلاحيات متاحة',
    color: 'text-emerald-700',
    icon: CheckCircle
  },
  limited_access: {
    name: 'صلاحية محدودة',
    description: 'صلاحيات محدودة حسب التصنيف',
    color: 'text-amber-700',
    icon: AlertTriangle
  },
  read_only: {
    name: 'قراءة فقط',
    description: 'عرض البيانات فقط بدون تعديل',
    color: 'text-primary-700',
    icon: Eye
  },
  no_access: {
    name: 'بدون صلاحية',
    description: 'لا توجد صلاحيات متاحة',
    color: 'text-rose-700',
    icon: XCircle
  }
}

export default function AdminPermissions() {
  const router = useRouter()
  const { user, userRole, hydrated, isAuthenticated } = useAppStore()
  const [teachers, setTeachers] = useState<TeacherPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherPermission | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated || userRole !== 'admin') {
      router.replace('/')
      return
    }
    loadTeachers()
  }, [hydrated, isAuthenticated, userRole, router])

  const loadTeachers = async () => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, permission_level')
        .order('created_at', { ascending: false })

      if (error) throw error

      const teachersWithPermissions = data?.map(teacher => ({
        teacher_id: teacher.id,
        teacher_name: teacher.name,
        permission_level: teacher.permission_level,
        permissions: getPermissionsForLevel(teacher.permission_level)
      })) || []

      setTeachers(teachersWithPermissions)
    } catch (error) {
      console.error('Error loading teachers:', error)
      toast.error('فشل تحميل قائمة المعلمين')
    } finally {
      setIsLoading(false)
    }
  }

  // Load overrides when selecting a teacher
  useEffect(() => {
    const loadOverrides = async () => {
      if (!selectedTeacher) return
      try {
        setIsLoadingOverrides(true)
        const adminData = user as any
        if (!adminData?.access_code) {
          toast.error('رمز المسؤول غير متاح')
          return
        }
        const { data, error } = await supabase.rpc('admin_get_teacher_permissions', {
          admin_access_code: adminData.access_code,
          target_teacher_id: selectedTeacher.teacher_id
        })
        if (error) throw error

        // Build a quick lookup map
        const overrides: Record<string, boolean> = {}
        ;(data || []).forEach((row: { permission_key: string; is_enabled: boolean }) => {
          overrides[row.permission_key] = row.is_enabled
        })

        // Merge overrides into current permission list
        setSelectedTeacher((prev) => {
          if (!prev) return prev
          const merged = prev.permissions.map((perm) => ({
            ...perm,
            is_enabled: overrides[perm.id] !== undefined ? overrides[perm.id] : perm.is_enabled
          }))
          return { ...prev, permissions: merged }
        })
      } catch (e) {
        console.error('Error loading overrides', e)
        toast.error('فشل تحميل الأذونات المخصصة')
      } finally {
        setIsLoadingOverrides(false)
      }
    }
    loadOverrides()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher?.teacher_id])

  const getPermissionsForLevel = (level: string): Permission[] => {
    const allPermissions: Permission[] = []
    
    Object.entries(PERMISSION_CATEGORIES).forEach(([categoryKey, category]) => {
      category.permissions.forEach(permission => {
        allPermissions.push({
          id: `${categoryKey}_${permission.name}`,
          name: permission.name,
          description: permission.description,
          category: categoryKey,
          is_enabled: isPermissionEnabled(level, categoryKey, permission.name)
        })
      })
    })

    return allPermissions
  }

  const isPermissionEnabled = (level: string, category: string, permission: string): boolean => {
    switch (level) {
      case 'full_access':
        return true
      case 'limited_access':
        // Allow content and grading, but not students or analytics
        return category === 'content' || category === 'grading'
      case 'read_only':
        // Only viewing permissions
        return permission.includes('view')
      case 'no_access':
        return false
      default:
        return false
    }
  }

  const updatePermissionLevel = async (teacherId: string, newLevel: string) => {
    try {
      setIsSaving(true)
      const adminData = user as any

      // Use admin RPC function to update teacher
      const { data, error } = await supabase.rpc('admin_update_teacher', {
        teacher_id: teacherId,
        updates: { permission_level: newLevel },
        admin_access_code: adminData.access_code
      })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }

      toast.success('تم تحديث مستوى الصلاحية بنجاح! ')
      
      // Update local state
      setTeachers(teachers.map(teacher => 
        teacher.teacher_id === teacherId 
          ? { ...teacher, permission_level: newLevel, permissions: getPermissionsForLevel(newLevel) }
          : teacher
      ))

      if (selectedTeacher?.teacher_id === teacherId) {
        setSelectedTeacher({
          ...selectedTeacher,
          permission_level: newLevel,
          permissions: getPermissionsForLevel(newLevel)
        })
      }
    } catch (error: any) {
      console.error('Error updating permission level:', error)
      toast.error(`فشل تحديث مستوى الصلاحية: ${error.message || 'حدث خطأ'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const togglePermission = async (teacherId: string, permissionId: string) => {
    try {
      if (!selectedTeacher) return
      setIsSaving(true)
      const adminData = user as any

      // Determine current state and next state
      const current = selectedTeacher.permissions.find(p => p.id === permissionId)?.is_enabled || false
      const next = !current

      const { data, error } = await supabase.rpc('admin_set_teacher_permission', {
        admin_access_code: adminData.access_code,
        target_teacher_id: teacherId,
        permission_key: permissionId,
        is_enabled: next
      })
      if (error) throw error

      // Update local state
      setSelectedTeacher({
        ...selectedTeacher,
        permissions: selectedTeacher.permissions.map(p =>
          p.id === permissionId ? { ...p, is_enabled: next } : p
        )
      })

      // Also reflect in list panel if needed
      setTeachers(prev => prev.map(t =>
        t.teacher_id === teacherId
          ? {
              ...t,
              permissions: t.permissions.map(p =>
                p.id === permissionId ? { ...p, is_enabled: next } : p
              )
            }
          : t
      ))

      toast.success('تم تحديث الإذن الفردي')
    } catch (e: any) {
      console.error('Error toggling permission:', e)
      toast.error(`فشل تحديث الإذن: ${e.message || 'حدث خطأ'}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (!hydrated) {
    return null
  }

  if (!isAuthenticated || userRole !== 'admin') {
    return null
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2 flex items-center gap-3">
                <Shield className="w-10 h-10 text-primary" />
                إدارة الصلاحيات
              </h1>
              <p className="text-slate-600 text-lg font-semibold">
                إدارة صلاحيات المعلمين والأذونات
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Teachers List */}
            <div className="lg:col-span-1">
              <Card>
                <h3 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-primary" />
                  قائمة المعلمين
                </h3>

                {isLoading ? (
                  <LoadingState compact />
                ) : teachers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-slate-500">لا يوجد معلمون</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teachers.map((teacher) => {
                      const levelInfo = PERMISSION_LEVELS[teacher.permission_level as keyof typeof PERMISSION_LEVELS]
                      const IconComponent = levelInfo.icon

                      return (
                        <motion.div
                          key={teacher.teacher_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-[border-color,background-color,box-shadow] ${
                            selectedTeacher?.teacher_id === teacher.teacher_id
                              ? 'border-primary bg-primary/10'
                              : 'border-slate-200 bg-white hover:bg-white'
                          }`}
                          onClick={() => setSelectedTeacher(teacher)}
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className={`w-5 h-5 ${levelInfo.color}`} />
                            <div className="flex-1">
                              <h4 className="text-ink font-bold">{teacher.teacher_name}</h4>
                              <p className={`text-sm font-semibold ${levelInfo.color}`}>
                                {levelInfo.name}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Permission Details */}
            <div className="lg:col-span-2">
              {selectedTeacher ? (
                <div className="space-y-6">
                  {/* Teacher Info */}
                  <Card>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-ink mb-2">
                          {selectedTeacher.teacher_name}
                        </h3>
                        <p className="text-slate-600 font-semibold">
                          {PERMISSION_LEVELS[selectedTeacher.permission_level as keyof typeof PERMISSION_LEVELS].description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {Object.entries(PERMISSION_LEVELS).map(([level, info]) => {
                          const IconComponent = info.icon
                          return (
                            <Button
                              key={level}
                              onClick={() => updatePermissionLevel(selectedTeacher.teacher_id, level)}
                              variant={selectedTeacher.permission_level === level ? 'primary' : 'ghost'}
                              size="sm"
                              icon={<IconComponent className="w-4 h-4" />}
                              disabled={isSaving}
                            >
                              {info.name}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </Card>

                  {/* Permission Categories */}
                  <div className="space-y-4">
                    {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                      <Card key={categoryKey}>
                        <h4 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                          <span className="text-2xl">{category.icon}</span>
                          {category.name}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {category.permissions.map((permission) => {
                            const permissionId = `${categoryKey}_${permission.name}`
                            const isEnabled = selectedTeacher.permissions.find(p => p.id === permissionId)?.is_enabled || false

                            return (
                              <div
                                key={permissionId}
                                className={`rounded-lg border-2 p-3 transition-[border-color,background-color] ${
                                  isEnabled
                                    ? 'border-accent-green bg-accent-green/10'
                                    : 'border-slate-200 bg-white'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="text-ink font-semibold">
                                      {permission.description}
                                    </h5>
                                    <p className="text-slate-500 text-sm">
                                      {permission.name}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isEnabled ? (
                                      <CheckCircle className="w-5 h-5 text-accent-green" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-gray-500" />
                                    )}
                                    <Button
                                      onClick={() => togglePermission(selectedTeacher.teacher_id, permissionId)}
                                      variant="ghost"
                                      size="sm"
                                      icon={isEnabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Card className="text-center py-12">
                  <Shield className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-ink mb-2">اختر معلم</h3>
                  <p className="text-slate-500">اختر معلم من القائمة لعرض صلاحياته</p>
                </Card>
              )}
            </div>
          </div>

          {/* Permission Level Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <Card className="bg-white  ">
              <h3 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                <Settings className="w-6 h-6" />
                مستويات الصلاحية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(PERMISSION_LEVELS).map(([level, info]) => {
                  const IconComponent = info.icon
                  return (
                    <div key={level} className="text-center">
                      <IconComponent className={`w-8 h-8 mx-auto mb-2 ${info.color}`} />
                      <h4 className="text-ink font-bold mb-1">{info.name}</h4>
                      <p className="text-slate-600 text-sm">{info.description}</p>
                    </div>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AnimatedBackground>
  )
}
