import { createClient } from '@supabase/supabase-js'
import { useAppStore } from './store'
import { getAudioExtensionFromMime, normalizeMimeType } from './utils'

// Use placeholder values during build time if env vars are not set
// These will be replaced at runtime when env vars are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials not configured - using placeholders for build')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Helper functions for common queries
export const authService = {
  async loginWithAccessCode(accessCode: string) {
    try {
      // Use the new authenticate_user function that sets session context
      const { data, error } = await supabase.rpc('authenticate_user', {
        access_code_param: accessCode
      })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }
      
      if (!data) {
        throw new Error('Invalid access code')
      }

      return {
        user: data.user,
        type: data.type
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  async registerStudent(accessCode: string, name: string) {
    try {
      // First authenticate to set context
      const authResult = await this.loginWithAccessCode(accessCode)
      
      if (authResult.type !== 'student') {
        throw new Error('Access code is not for a student')
      }

      // Update student with name and mark as registered
      const { data, error } = await supabase
        .from('students')
        .update({
          name: name,
          is_registered: true
        })
        .eq('access_code', accessCode)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  },
}

export const studentsService = {
  async getClassrooms(accessCode: string) {
    try {
      await authService.loginWithAccessCode(accessCode)
      const { data, error } = await supabase.rpc('student_get_classrooms', {
        student_access_code: accessCode
      })
      if (error) throw error
      return (data || []) as { classroom_id: string; classroom_name: string; grade: number; teacher_name: string }[]
    } catch (error) {
      console.error('Error in getClassrooms:', error)
      throw error
    }
  },
}

export const storiesService = {
  async getStoriesByGrade(gradeLevel: number) {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('grade_level', gradeLevel)
      .order('difficulty', { ascending: true })

    if (error) throw error
    return data
  },

  async getStudentStories(studentAccessCode: string) {
    const { data, error } = await supabase.rpc('student_get_stories', {
      student_access_code: studentAccessCode
    })

    if (error) throw error
    return data
  },

  async getStudentSingleStory(studentAccessCode: string, storyId: string) {
    try {
      // First authenticate to ensure session context is set
      await authService.loginWithAccessCode(studentAccessCode)
      
      const { data, error } = await supabase.rpc('student_get_single_story', {
        student_access_code: studentAccessCode,
        story_uuid: storyId
      })

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error('Error in getStudentSingleStory:', error)
      throw error
    }
  },

  async getStudentStoryStatus(studentAccessCode: string, classroomId?: string) {
    try {
      await authService.loginWithAccessCode(studentAccessCode)

      const params: { student_access_code: string; classroom_id_param?: string } = {
        student_access_code: studentAccessCode
      }
      if (classroomId) params.classroom_id_param = classroomId

      const { data, error } = await supabase.rpc('student_get_story_status', params)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error in getStudentStoryStatus:', error)
      throw error
    }
  },

  async getStoryProgress(studentId: string, storyId: string) {
    const { data, error } = await supabase
      .from('student_story_progress')
      .select('*')
      .eq('student_id', studentId)
      .eq('story_id', storyId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  },

  async updateStoryProgress(studentId: string, storyId: string, status: string) {
    const { data, error } = await supabase
      .from('student_story_progress')
      .upsert({
        student_id: studentId,
        story_id: storyId,
        status,
        updated_at: new Date().toISOString(),
      })
      .select()

    if (error) throw error
    return data
  },

  async getTeacherStories(teacherAccessCode: string) {
    try {
      await authService.loginWithAccessCode(teacherAccessCode)
      
      const { data, error } = await supabase.rpc('teacher_get_stories', {
        teacher_access_code: teacherAccessCode
      })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error in getTeacherStories:', error)
      throw error
    }
  },

  async updateStory(teacherAccessCode: string, storyId: string, updates: any) {
    try {
      await authService.loginWithAccessCode(teacherAccessCode)
      
      const { data, error } = await supabase.rpc('teacher_update_story', {
        teacher_access_code: teacherAccessCode,
        story_id_param: storyId,
        story_title: updates.title_arabic,
        story_content: updates.content_arabic,
        story_difficulty: updates.difficulty
      })

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error('Error in updateStory:', error)
      throw error
    }
  },

  async deleteStory(teacherAccessCode: string, storyId: string) {
    try {
      await authService.loginWithAccessCode(teacherAccessCode)
      
      const { data, error } = await supabase.rpc('teacher_delete_story', {
        teacher_access_code: teacherAccessCode,
        story_id_param: storyId
      })

      if (error) throw error
      return data?.[0] || null
    } catch (error) {
      console.error('Error in deleteStory:', error)
      throw error
    }
  },
}

export const storageService = {
  async uploadAudioRecording(audioBlob: Blob, studentAccessCode: string, storyId: string): Promise<string> {
    try {
      if (audioBlob.size > 10 * 1024 * 1024) {
        throw new Error('Audio recording exceeds the 10 MB upload limit')
      }

      const originalMimeType = normalizeMimeType(audioBlob.type)
      const allowedMimeTypes = new Set([
        'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/m4a',
        'audio/aac', 'audio/ogg', 'video/mp4'
      ])
      const uploadMimeType = originalMimeType === 'audio/mp4' || originalMimeType === 'audio/m4a'
        ? 'video/mp4'
        : allowedMimeTypes.has(originalMimeType)
          ? originalMimeType
          : 'application/octet-stream'
      const extension = getAudioExtensionFromMime(uploadMimeType)

      const ticketResponse = await fetch('/api/student/audio-upload-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentAccessCode, storyId, extension, contentType: uploadMimeType })
      })
      const ticket = await ticketResponse.json() as { path?: string; token?: string; publicUrl?: string; error?: string }
      if (!ticketResponse.ok || !ticket.path || !ticket.token || !ticket.publicUrl) {
        throw new Error(ticket.error || 'Failed to authorize audio upload')
      }

      const filename = ticket.path.split('/').pop() || `recording.${extension}`
      const file = new File([audioBlob], filename, { type: uploadMimeType })
      const uploadResult = await supabase.storage
        .from('student-recordings')
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: uploadMimeType })

      if (uploadResult.error) {
        console.error('Error uploading audio:', uploadResult.error)
        throw uploadResult.error
      }

      return ticket.publicUrl
    } catch (error) {
      console.error('Failed to upload audio recording:', error)
      throw error
    }
  },
}

export const formsService = {
  async getFormByStory(storyId: string) {
    const { data, error } = await supabase
      .from('form_templates')
      .select('*')
      .eq('story_id', storyId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  },

  async getStudentFormTemplate(studentAccessCode: string, storyId: string) {
    const { data, error } = await supabase.rpc('student_get_form_template', {
      student_access_code: studentAccessCode,
      story_uuid: storyId
    })

    if (error) throw error
    return data?.[0] || null
  },

}

export const gradingService = {
  async getTeacherSubmissions(teacherAccessCode: string) {
    const response = await fetch('/api/teacher/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherAccessCode })
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Failed to load teacher submissions')
    return result || []
  },

  async gradeSubmission(submissionId: string, grade: number, feedback: string, voiceGrade?: number) {
    console.log('Grading submission:', { submissionId, grade, feedback, voiceGrade })
    
    // Use the new RPC function instead of direct table update
    const params: any = {
      teacher_access_code: (await this.getCurrentTeacherAccessCode()),
      submission_id_param: submissionId,
      grade_value: grade,
      feedback_text: feedback
    }
    
    if (voiceGrade !== undefined) {
      params.voice_grade_value = voiceGrade
    }
    
    const { data, error } = await supabase.rpc('teacher_grade_submission', params)

    if (error) {
      console.error('Error grading submission:', error)
      throw error
    }
    
    console.log('Submission graded successfully:', data)
    return data?.[0] || null
  },

  async getCurrentTeacherAccessCode() {
    // Get the current teacher or admin access code from the store
    const { user, userRole } = useAppStore.getState()
    if (!user || !('access_code' in user)) {
      throw new Error('User access code not available')
    }
    // Admins can also grade submissions
    if (userRole !== 'teacher' && userRole !== 'admin') {
      throw new Error('Only teachers and admins can grade submissions')
    }
    return (user as any).access_code as string
  },
}

export const studentSubmissionsService = {
  async getStudentSubmissions(studentAccessCode: string) {
    const { data, error } = await supabase.rpc('student_get_submissions', {
      student_access_code: studentAccessCode
    })

    if (error) {
      console.error('Error loading student submissions:', error)
      throw error
    }

    return data || []
  },
}

export const adminGradingService = {
  async getGradeSubmissions(gradeLevel: number, adminAccessCode: string) {
    console.log('Loading submissions for grade:', gradeLevel)

    const response = await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminAccessCode,
        resource: 'grade_submissions',
        gradeLevel
      })
    })
    const result = await response.json()
    if (!response.ok) {
      console.error('Error loading grade submissions:', result.error)
      throw new Error(result.error || 'Failed to load grade submissions')
    }

    console.log('Loaded submissions for grade:', result.submissions?.length || 0)
    return result.submissions || []
  },
}

export const leaderboardService = {
  async getLeaderboard(classroomId?: string) {
    console.log('Loading leaderboard data...')
    
    // Use the real-time leaderboard function instead of cache
    const { data, error } = await supabase.rpc('get_realtime_leaderboard')

    if (error) {
      console.error('Error loading leaderboard:', error)
      throw error
    }
    
    console.log('Leaderboard data loaded:', data?.length, 'students')
    
    // Filter by classroom if specified
    let filteredData = data || []
    if (classroomId) {
      // Note: We'd need to join with classrooms table to filter by classroom_id
      // For now, return all data
    }
    
    const processedData = filteredData.map((entry: any) => ({
      student_id: entry.student_id,
      name: entry.student_name,
      stories_read: entry.stories_read,
      forms_submitted: entry.forms_submitted,
      combined_score: entry.combined_score,
      rank: entry.rank,
      current_title: entry.current_title,
      grade: entry.grade,
      avg_grade: entry.avg_grade,
      graded_submissions: entry.graded_submissions,
      total_score: entry.total_score
    }))
    
    console.log('Processed leaderboard data:', processedData.length, 'entries')
    return processedData
  },

  async getLeaderboardByClassroom(accessCode: string, classroomId: string) {
    const { data, error } = await supabase.rpc('student_get_leaderboard_for_classroom', {
      student_access_code: accessCode,
      classroom_id_param: classroomId
    })
    if (error) throw error
    return (data || []).map((entry: any) => ({
      student_id: entry.student_id,
      name: entry.student_name,
      stories_read: entry.stories_read,
      forms_submitted: entry.forms_submitted,
      combined_score: entry.combined_score,
      rank: entry.rank,
      current_title: entry.current_title,
      grade: entry.grade,
      avg_grade: entry.avg_grade,
      graded_submissions: entry.graded_submissions,
      total_score: entry.total_score
    }))
  },

  async getTeacherLeaderboard(teacherAccessCode: string) {
    console.log('Loading teacher leaderboard data...')
    const { data, error } = await supabase.rpc('teacher_get_leaderboard', {
      teacher_access_code: teacherAccessCode
    })

    if (error) {
      console.error('Error loading teacher leaderboard:', error)
      throw error
    }

    const processedData = (data || []).map((entry: any) => ({
      student_id: entry.student_id,
      name: entry.student_name,
      stories_read: entry.stories_read,
      forms_submitted: entry.forms_submitted,
      combined_score: entry.combined_score,
      rank: entry.rank,
      current_title: entry.current_title,
      grade: entry.grade,
      avg_grade: entry.avg_grade,
      graded_submissions: entry.graded_submissions,
      total_score: entry.total_score,
    }))

    return processedData
  },

  async refreshLeaderboardCache() {
    const { error } = await supabase.rpc('refresh_leaderboard_cache')
    if (error) throw error
  },
}

export const analyticsService = {
  async getTeacherAnalytics(teacherAccessCode: string) {
    const { data, error } = await supabase.rpc('get_teacher_analytics', {
      teacher_access_code: teacherAccessCode
    })

    if (error) throw error
    return data?.[0] || null
  },

  async getAdminAnalytics(adminAccessCode: string) {
    try {
      console.log('getAdminAnalytics called with:', adminAccessCode)
      console.log('Supabase client configured:', !!supabase)
      
      console.log('Calling admin_get_analytics RPC directly...')
      const { data, error } = await supabase.rpc('admin_get_analytics', {
        admin_access_code: adminAccessCode
      })

      console.log('RPC response:', { data, error })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }
      
      console.log('Raw data from RPC:', data)
      console.log('First element:', data?.[0])
      
      // Handle different response formats
      let analyticsData = null
      
      if (Array.isArray(data) && data.length > 0) {
        // Check if it's in format: [{"admin_get_analytics": {...}}]
        if (data[0]?.admin_get_analytics) {
          analyticsData = data[0].admin_get_analytics
        } 
        // Check if it's in format: [{...}] (direct data)
        else if (data[0] && typeof data[0] === 'object') {
          analyticsData = data[0]
        }
      } else if (data && typeof data === 'object') {
        // Direct object response
        analyticsData = data
      }
      
      console.log('Extracted analytics data:', analyticsData)
      console.log('Returning data:', analyticsData)
      return analyticsData
    } catch (error) {
      console.error('Error in getAdminAnalytics:', error)
      throw error
    }
  },
}

export const adminService = {
  async ensureAdminContext() {
    // Check if we have a current user in the store
    const { user } = useAppStore.getState()
    if (!user) {
      throw new Error('No user logged in')
    }
    
    // Re-authenticate to ensure session context is set
    const accessCode = (user as any).access_code as string
    const authResult = await authService.loginWithAccessCode(accessCode)
    if (authResult.type !== 'admin') {
      throw new Error('User is not an admin')
    }
    
    return authResult.user
  },

  async createTeacher(teacherData: any) {
    const admin = await this.ensureAdminContext()
    
    // Generate unique email with timestamp and random string
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)
    const uniqueEmail = `teacher.grade${teacherData.assigned_grade}.${timestamp}${random}@library.edu`
    
    const { data, error } = await supabase.rpc('admin_create_teacher', {
      teacher_name: teacherData.name,
      teacher_email: teacherData.email || uniqueEmail,
      teacher_access_code: teacherData.access_code,
      teacher_grade: teacherData.assigned_grade,
      teacher_permission: teacherData.permission_level,
      admin_access_code: admin.access_code
    })

    if (error) throw error
    return data
  },

  async updateTeacher(teacherId: string, updates: any) {
    const admin = await this.ensureAdminContext()
    
    const { data, error } = await supabase.rpc('admin_update_teacher', {
      teacher_id: teacherId,
      updates: updates,
      admin_access_code: admin.access_code
    })

    if (error) throw error
    return data
  },

  async deleteTeacher(teacherId: string) {
    const admin = await this.ensureAdminContext()
    
    const { data, error } = await supabase.rpc('admin_delete_teacher', {
      teacher_id: teacherId,
      admin_access_code: admin.access_code
    })

    if (error) throw error
    return data
  }
}

export default supabase
