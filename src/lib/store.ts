import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, UserRole } from '@/types'

interface AppState {
  user: User | null
  userRole: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  selectedClassroomId: string | null
  setUser: (user: User | null, role: UserRole | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSelectedClassroomId: (id: string | null) => void
  logout: () => void
  hydrated: boolean
  setHydrated: (hydrated: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      userRole: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hydrated: false,
      setUser: (user, role) => {
        set({
          user,
          userRole: role,
          isAuthenticated: !!user,
          error: null,
        })
      },
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      selectedClassroomId: null,
      setSelectedClassroomId: (id) => set({ selectedClassroomId: id }),
      logout: () => {
        set({
          user: null,
          userRole: null,
          isAuthenticated: false,
          error: null,
          selectedClassroomId: null,
        })
      },
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        user: state.user,
        userRole: state.userRole,
        isAuthenticated: state.isAuthenticated,
        selectedClassroomId: state.selectedClassroomId,
      }),
      onRehydrateStorage: () => (state) => {
        // Called after state is rehydrated from storage
        state?.setHydrated(true)
      },
    }
  )
)

interface ThemeState {
  isDarkMode: boolean
  toggleDarkMode: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: false,
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}))
