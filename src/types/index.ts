// User Types
export type UserRole = 'student' | 'teacher' | 'admin'

export interface User {
  id: string
  email?: string
  user_type: UserRole
  created_at: string
  updated_at: string
}

export interface Student extends User {
  name: string
  classroom_id: string
  access_code: string
  achievements: string[]
  stories_read: number
  forms_submitted: number
  current_title_id?: string
  is_registered: boolean
}

export interface Teacher extends User {
  name: string
  assigned_grade: number
  permission_level: 'full_access' | 'limited_access' | 'read_only' | 'no_access'
  access_code: string
}

export interface Admin extends User {
  name: string
  access_code: string
}

// Story Types
export type Difficulty = 'easy' | 'medium' | 'hard'
export type StoryStatus = 'not_started' | 'in_progress' | 'completed'

export interface Story {
  id: string
  title_arabic: string
  content_arabic: string
  difficulty: Difficulty
  grade_level: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface StudentStoryProgress {
  id: string
  student_id: string
  story_id: string
  status: StoryStatus
  pages_read: number
  total_pages: number
  reading_time_seconds: number
  completed_at?: string
}

// Form Types
export type QuestionType = 'short_answer' | 'long_answer' | 'multiple_choice'

export interface FormQuestion {
  id: string
  text_arabic: string
  type: QuestionType
  required: boolean
  options?: string[]
}

export interface FormTemplate {
  id: string
  story_id: string
  title_arabic: string
  questions: FormQuestion[]
  created_at: string
}

export interface StudentSubmission {
  id: string
  student_id: string
  story_id: string
  form_id: string
  answers: Record<string, string>
  submitted_at: string
  grade?: number
  feedback_arabic?: string
}

// Achievement Types
export interface AchievementTitle {
  id: string
  title_arabic: string
  icon: string
  min_stories_read: number
  min_forms_submitted: number
  created_at: string
}

export interface StudentAchievement {
  id: string
  student_id: string
  achievement_id: string
  earned_at: string
}

// Student multiple classrooms
export interface StudentClassroom {
  classroom_id: string
  classroom_name: string
  grade: number
  teacher_name: string
}

// Leaderboard
export interface LeaderboardEntry {
  student_id: string
  name: string
  stories_read: number
  forms_submitted: number
  combined_score: number
  rank: number
  current_title: string
  grade: number
}

// Auth Context
export interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  login: (accessCode: string) => Promise<void>
  logout: () => Promise<void>
}
