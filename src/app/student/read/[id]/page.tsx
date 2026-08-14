'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import Button from '@/components/Button'
import Card from '@/components/Card'
import LoadingState from '@/components/LoadingState'
import StoryQuestions from '@/components/student/StoryQuestions'
import { useAppStore } from '@/lib/store'
import { storiesService, storageService } from '@/lib/supabase'
import { normalizeMimeType } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { AlertCircle, Clock3, Mic, Pause, Play, Square, Trash2 } from 'lucide-react'

export default function StoryReader() {
  const router = useRouter()
  const params = useParams()
  const { user, isAuthenticated, hydrated } = useAppStore()
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [readingTime, setReadingTime] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [story, setStory] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioMimeType, setAudioMimeType] = useState('audio/webm')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recordingDurationRef = useRef<NodeJS.Timeout | null>(null)

  const storyId = params.id as string

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) {
      router.push('/')
      return
    }

    // Load story data
    const loadStory = async () => {
      try {
        setIsLoading(true)
        console.log('Loading story with ID:', storyId)
        
        const studentData = user as any
        const studentAccessCode = studentData.access_code
        
        console.log('Student access code:', studentAccessCode)
        
        const storyData = await storiesService.getStudentSingleStory(studentAccessCode, storyId)

        if (!storyData) {
          console.error('Story not found or not accessible')
          toast.error('القصة غير متاحة')
          router.push('/student')
          return
        }

        console.log('Loaded story:', storyData)
        console.log('Story title:', storyData.title_arabic)
        console.log('Story content:', storyData.content_arabic)
        console.log('Story content length:', storyData.content_arabic?.length)
        setStory(storyData)
      } catch (error) {
        console.error('Failed to load story:', error)
        toast.error('حدث خطأ في تحميل القصة')
        router.push('/student')
      } finally {
        setIsLoading(false)
      }
    }

    loadStory()

    // Track reading time
    const timer = setInterval(() => {
      setReadingTime((prev) => prev + 1)
    }, 1000)

    return () => {
      clearInterval(timer)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [hydrated, isAuthenticated, router, storyId])

  // Restore uploaded audio URL from localStorage (so replay works after refresh/navigation)
  useEffect(() => {
    try {
      const storageKey = `audio_recording_${storyId}`
      const savedUrl = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (savedUrl && !audioUrl) {
        setAudioUrl(savedUrl)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId])

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current)
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // Start recording
  const startRecording = async () => {
    try {
      console.log(' Starting recording...')
      console.log('User agent:', navigator.userAgent)
      console.log('Has getUserMedia:', !!navigator.mediaDevices?.getUserMedia)
      console.log('Has MediaRecorder:', typeof MediaRecorder !== 'undefined')

      // Check if MediaRecorder API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'متصفحك لا يدعم التسجيل الصوتي. استخدم Chrome أو Firefox'
        console.error('getUserMedia not supported')
        toast.error(errorMsg)
        return
      }
      
      // Check if MediaRecorder exists
      if (typeof MediaRecorder === 'undefined') {
        const errorMsg = 'متصفحك لا يدعم MediaRecorder. استخدم Chrome أو Firefox'
        console.error('MediaRecorder not supported')
        toast.error(errorMsg)
        return
      }

      console.log('Recording APIs supported, requesting permission...')

      // Request microphone permission - simplified for better mobile support
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true // Simplified to just request audio, let browser handle the rest
        })
        console.log('Microphone permission granted')
      } catch (permError: any) {
        console.error('Permission error:', permError)
        throw permError
      }
      
      const preferredMimeTypes = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        'audio/mpeg',
        'audio/webm;codecs=opus',
        'audio/webm'
      ]

      let mimeType = 'audio/webm'
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        for (const candidate of preferredMimeTypes) {
          try {
            if (MediaRecorder.isTypeSupported(candidate)) {
              mimeType = candidate
              console.log('Using supported mimeType:', candidate)
              break
            }
          } catch (err) {
            console.warn('Error checking mimeType support for', candidate, err)
          }
        }
      } else {
        console.log('MediaRecorder.isTypeSupported is not available')
      }
      
      console.log('Creating MediaRecorder with mimeType:', mimeType)
      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType })
      } catch (creationError) {
        console.warn('Failed to create MediaRecorder with mimeType', mimeType, creationError)
        mediaRecorder = new MediaRecorder(stream)
        mimeType = mediaRecorder.mimeType || mimeType
      }
      mediaRecorderRef.current = mediaRecorder
      
      const chunks: Blob[] = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
          console.log(' Data chunk received:', event.data.size, 'bytes')
        }
      }
      
      mediaRecorder.onstop = () => {
        console.log(' Recording stopped, creating blob from', chunks.length, 'chunks')
        const finalMimeType = normalizeMimeType(mediaRecorder.mimeType || mimeType)
        const blob = new Blob(chunks, { type: finalMimeType })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        setAudioMimeType(finalMimeType === 'audio/mp4' ? 'audio/m4a' : finalMimeType)
        stream.getTracks().forEach(track => track.stop())
        console.log('Recording saved successfully')
        toast.success('تم حفظ التسجيل! ')
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event)
        toast.error('حدث خطأ أثناء التسجيل')
        setIsRecording(false)
        stream.getTracks().forEach(track => track.stop())
      }
      
      console.log(' Starting MediaRecorder...')
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      
      // Start duration counter
      recordingDurationRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
      
      console.log('Recording started successfully')
      toast.success('بدأ التسجيل ')
    } catch (error: any) {
      console.error('Error starting recording:', error)
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      
      // Detailed error messages for different failure scenarios
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('الرجاء السماح بالوصول للميكروفون. على الجوال: اضغط قفل في العنوان ← الموقع ← السماح', {
          duration: 6000
        })
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error('لم يتم العثور على ميكروفون. تأكد من توصيل ميكروفون')
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        toast.error('الميكروفون مستخدم من قبل تطبيق آخر. أغلقه وحاول مرة أخرى')
      } else if (error.name === 'OverconstrainedError') {
        toast.error('إعدادات الميكروفون غير مدعومة')
      } else if (error.name === 'TypeError' && error.message?.includes('Failed to construct')) {
        toast.error('المتصفح لا يدعم التسجيل. جرب Chrome أو Firefox على HTTPS')
      } else {
        const errorMsg = error.message || error.name || 'خطأ غير معروف'
        console.error('Unexpected error:', error)
        toast.error(`فشل: ${errorMsg}`)
      }
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current)
      }
      toast.success('تم إيقاف التسجيل')
    }
  }

  // Play audio
  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
      toast.success('تشغيل التسجيل ')
    }
  }

  // Stop audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  // Reset previously saved/loaded recording and start a new one
  const resetRecording = async () => {
    try {
      const storageKey = `audio_recording_${storyId}`
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey)
      }
    } catch {}
    // Ensure any current playback/recording is stopped
    if (isPlaying) stopAudio()
    if (isRecording) stopRecording()
    deleteRecording()
    await startRecording()
  }

  // Handle audio ended
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      const handleEnded = () => setIsPlaying(false)
      audio.addEventListener('ended', handleEnded)
      return () => audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  // Delete recording
  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
      setAudioBlob(null)
      setAudioMimeType('audio/webm')
      setIsPlaying(false)
      toast.success('تم حذف التسجيل')
    }
  }

  const handleComplete = async () => {
    try {
      // Check if audio recording exists
      if (!audioUrl || !audioBlob) {
        toast.error('يرجى تسجيل صوتك أولاً قبل المتابعة! ', {
          duration: 4000,
          style: {
            background: '#ef4444',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 'bold',
          }
        })
        return
      }

      // Upload audio recording
      toast.loading('جاري حفظ التسجيل الصوتي...', { id: 'uploading' })
      
      const studentData = user as any
      const studentAccessCode = studentData.access_code
      
      try {
        const uploadedAudioUrl = await storageService.uploadAudioRecording(audioBlob, studentAccessCode, storyId)
        
        // Store the audio URL in localStorage with story ID as key
        const storageKey = `audio_recording_${storyId}`
        localStorage.setItem(storageKey, uploadedAudioUrl)
        
        toast.success('تم حفظ التسجيل الصوتي بنجاح! ', { id: 'uploading' })
      } catch (error) {
        console.error('Error uploading audio:', error)
        toast.error('فشل تحميل التسجيل الصوتي', { id: 'uploading' })
        return
      }
      
      toast.success('تم حفظ التسجيل الصوتي بنجاح! ')
    } catch (error) {
      console.error('Error completing story:', error)
      toast.error('حدث خطأ في إكمال القصة')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <AnimatedBackground>
        <div className="min-h-screen" dir="rtl"><LoadingState label="جاري تحميل القصة..." /></div>
      </AnimatedBackground>
    )
  }

  if (!story) {
    return (
      <AnimatedBackground>
        <div className="w-full h-screen flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertCircle className="h-8 w-8" aria-hidden="true" /></div>
            <p className="text-2xl font-bold text-ink">لم يتم العثور على القصة</p>
            <Button onClick={() => router.push('/student')} className="mt-4">
              العودة للصفحة الرئيسية
            </Button>
          </div>
        </div>
      </AnimatedBackground>
    )
  }

  return (
    <>
      <Toaster position="top-center" />

      {isFullScreen ? (
        // Full Screen Reading Mode
        <motion.div
          className="fixed inset-0 bg-white    z-50"
          onClick={() => setShowControls(!showControls)}
          onMouseMove={() => setShowControls(true)}
        >
          {/* Story Content */}
          <div className="w-full h-full flex flex-col items-center justify-start overflow-auto p-4 md:p-12 pt-20 pb-48 md:pt-12 md:pb-60">
            <div className="max-w-4xl w-full mt-8 md:mt-0">
              {/* Story Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
              >
                <h1 className="text-4xl md:text-5xl font-bold text-ink mb-4 font-arabic">
                  {story.title_arabic}
                </h1>
                <p className="text-slate-700 text-lg mb-4">قصة جميلة ومفيدة</p>
                <div className="flex justify-center gap-4">
                  <span className={`px-4 py-2 text-ink rounded-full font-bold ${
                    story.difficulty === 'easy' ? 'bg-accent-green' :
                    story.difficulty === 'medium' ? 'bg-secondary' : 'bg-accent-red'
                  }`}>
                    {story.difficulty === 'easy' ? 'سهل' : 
                     story.difficulty === 'medium' ? 'متوسط' : 'صعب'}
                  </span>
                  <span className="px-4 py-2 bg-primary text-ink rounded-full font-bold">
                    الصف {story.grade_level}
                  </span>
                </div>
              </motion.div>

              {/* Story Content */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8 overflow-x-hidden overflow-y-visible rounded-xl border border-gray-200 bg-white p-4 text-start text-xl leading-relaxed text-gray-800 shadow-lg md:p-8"
              >
                <div className="whitespace-pre-wrap font-arabic break-words" style={{ lineHeight: '2' }}>
                  {story.content_arabic}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Hidden Audio Player */}
          {audioUrl && (
            <audio ref={audioRef} src={audioUrl} />
          )}

          {/* Top Controls */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : -20 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 start-0 end-0 p-4 bg-white   flex justify-between items-center pointer-events-none"
          >
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="md"
              className="text-ink pointer-events-auto hover:bg-white"
            >
              العودة
            </Button>
            <span className="flex items-center gap-2 text-lg font-bold text-ink" dir="ltr">
              <Clock3 className="h-5 w-5" aria-hidden="true" /> {formatTime(readingTime)}
            </span>
          </motion.div>

          {/* Bottom Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-0 start-0 end-0 p-6 bg-white   flex flex-col items-center gap-4 pointer-events-none"
          >
            {/* Recording Controls */}
            <div className="flex gap-3 pointer-events-auto items-center">
              {isRecording && (
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-ink rounded-lg font-bold">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-rose-600"></div>
                  <span>{formatTime(recordingDuration)}</span>
                </div>
              )}
              {!audioUrl ? (
                <>
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      variant="secondary"
                      size="md"
                      className="border border-secondary-200 bg-secondary-50 text-secondary-700 hover:bg-secondary-100"
                      icon={<Mic className="h-4 w-4" />}
                    >
                      بدء التسجيل
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      variant="danger"
                      size="lg"
                      className="shadow-lg"
                      icon={<Square className="h-4 w-4" />}
                    >
                      إيقاف التسجيل
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={isPlaying ? stopAudio : playAudio}
                    variant={isPlaying ? "secondary" : "primary"}
                    size="md"
                    icon={isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  >
                    {isPlaying ? 'إيقاف' : 'تشغيل'}
                  </Button>
                  <Button
                    onClick={deleteRecording}
                    variant="ghost"
                    size="md"
                    className="border border-slate-200 bg-white hover:bg-slate-50"
                    icon={<Trash2 className="h-4 w-4" />}
                  >
                    حذف
                  </Button>
                </>
              )}
            </div>

            {/* Main Controls */}
            <div className="flex gap-4 pointer-events-auto">
              {!isRecording && (
                <Button
                  onClick={() => setIsFullScreen(false)}
                  variant="secondary"
                  size="lg"
                >
                  الخروج من ملء الشاشة
                </Button>
              )}
              <Button
                onClick={handleComplete}
                variant={!audioUrl ? "ghost" : "primary"}
                size="lg"
                className={!audioUrl ? "border-2 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "shadow-lg"}
              >
                {!audioUrl ? " يجب التسجيل أولاً" : "انتهيت من القراءة "}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        // Normal Reading Mode with side-by-side questions
        <AnimatedBackground>
          <div className="page-container min-h-screen pb-28 md:pb-32" dir="rtl">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 className="text-xl font-bold text-ink md:text-4xl">{story.title_arabic}</h1>
                <Button
                  onClick={() => router.back()}
                  variant="ghost"
                  size="sm"
                  className="w-full md:w-auto"
                >
                  العودة
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
                {/* Questions (left on desktop, below on mobile) */}
                <div className="order-2 md:order-1">
                  <StoryQuestions
                    storyId={storyId}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    isRecordingExternal={isRecording}
                    hasAudioExternal={!!audioUrl}
                    isPlayingExternal={isPlaying}
                    onTogglePlay={() => (isPlaying ? stopAudio() : playAudio())}
                    onResetRecording={resetRecording}
                    onSubmitRecording={handleComplete}
                  />
                </div>

                {/* Story (right on desktop, above on mobile) */}
                <div className="order-1 md:order-2">
                  {/* Info */}
                  <Card className="mb-6" elevation="sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <p className="text-slate-700 text-sm">وقت القراءة</p>
                        <p className="text-xl md:text-2xl font-bold text-primary">{formatTime(readingTime)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-block px-3 py-1 md:px-4 md:py-2 text-ink text-sm rounded-full font-bold ${
                          story.difficulty === 'easy' ? 'bg-accent-green' :
                          story.difficulty === 'medium' ? 'bg-secondary' : 'bg-accent-red'
                        }`}>
                          {story.difficulty === 'easy' ? 'سهل' : 
                           story.difficulty === 'medium' ? 'متوسط' : 'صعب'}
                        </span>
                        <span className="inline-block px-3 py-1 md:px-4 md:py-2 bg-primary text-ink text-sm rounded-full font-bold">
                          الصف {story.grade_level}
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* Story */}
                  <Card elevation="md" padding="lg" className="mb-6 overflow-hidden">
                    <div className="text-base md:text-xl text-start leading-relaxed space-y-4 font-arabic" style={{ lineHeight: '2.2' }}>
                      <div className="whitespace-pre-wrap p-3 md:p-6 rounded-lg break-words">
                        {story.content_arabic}
                      </div>
                    </div>
                  </Card>

                  {/* Voice Recording Card */}
                  <Card elevation="md" padding="lg" className="mb-6" id="student-recording-section">
                    <div className="mb-4">
                      <h3 className="text-lg md:text-xl font-bold text-ink mb-2"> تسجيل القراءة</h3>
                      <p className="text-slate-700 text-xs md:text-sm">سجل نفسك وأنت تقرأ، ثم استمع إلى تسجيلك</p>
                    </div>

                    {isRecording && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-4 p-4 bg-red-50 rounded-lg border-2 border-rose-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-3 w-3 animate-pulse rounded-full bg-rose-600"></div>
                            <span className="text-red-700 font-bold">جاري التسجيل...</span>
                          </div>
                          <span className="text-red-700 font-bold">{formatTime(recordingDuration)}</span>
                        </div>
                      </motion.div>
                    )}

                    <div className="flex gap-2 md:gap-3 flex-wrap">
                      {!audioUrl ? (
                        <>
                          {!isRecording ? (
                            <Button
                              onClick={startRecording}
                              variant="primary"
                              size="md"
                              className="flex-1 min-w-[120px] text-sm md:text-base"
                              icon={<Mic className="h-4 w-4" />}
                            >
                              بدء التسجيل
                            </Button>
                          ) : (
                            <Button
                              onClick={stopRecording}
                              variant="danger"
                              size="md"
                              className="flex-1 min-w-[120px] text-sm md:text-base"
                              icon={<Square className="h-4 w-4" />}
                            >
                              إيقاف
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={isPlaying ? stopAudio : playAudio}
                            variant={isPlaying ? "secondary" : "primary"}
                            size="md"
                            className="flex-1 min-w-[120px] text-sm md:text-base"
                            icon={isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          >
                            {isPlaying ? 'إيقاف' : 'تشغيل'}
                          </Button>
                          <Button
                            onClick={deleteRecording}
                            variant="ghost"
                            size="md"
                            className="border-2 border-gray-300 text-sm md:text-base"
                            icon={<Trash2 className="h-4 w-4" />}
                          >
                            حذف
                          </Button>
                        </>
                      )}
                    </div>

                    {audioUrl && (
                      <audio ref={audioRef} src={audioUrl} />
                    )}
                  </Card>

                  {/* Actions moved to floating main bar */}
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatedBackground>
      )}
    </>
  )
}
