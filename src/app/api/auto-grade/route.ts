import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'
import { autoGradeSubmission, GradingQuestion, GroqConfigurationError } from '@/lib/groq'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_REQUEST_LENGTH = 4_000

type PreparedTeacherGrading = {
  questions: GradingQuestion[]
  answers: Record<string, string>
  story: {
    title_arabic: string
    content_arabic: string
    difficulty: string
    grade_level: number
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > MAX_REQUEST_LENGTH) {
    return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }
  if (rawBody.length > MAX_REQUEST_LENGTH) {
    return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }

  const teacherAccessCode = typeof body.teacherAccessCode === 'string' ? body.teacherAccessCode.trim() : ''
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
  if (!teacherAccessCode || teacherAccessCode.length > 64 || !UUID_PATTERN.test(submissionId)) {
    return NextResponse.json({ error: 'طلب التقييم غير صالح' }, { status: 400 })
  }

  let prepared: PreparedTeacherGrading
  try {
    prepared = await callAutoGradingGateway<PreparedTeacherGrading>({
      action: 'prepare_teacher',
      teacherAccessCode,
      submissionId
    })
  } catch (error) {
    if (error instanceof AutoGradingGatewayError) {
      if (error.status === 429) {
        return NextResponse.json({ error: 'تم تجاوز عدد محاولات التقييم. يرجى الانتظار قليلاً.' }, { status: 429 })
      }
      if (error.status >= 400 && error.status < 500) {
        return NextResponse.json({ error: 'غير مصرح بعرض هذه الإجابة' }, { status: error.status })
      }
    }
    console.error('Teacher grading authorization failed:', error)
    return NextResponse.json({ error: 'تعذر تجهيز التقييم' }, { status: 500 })
  }

  try {
    const result = await autoGradeSubmission({
      questions: prepared.questions,
      answers: prepared.answers,
      storyContent: prepared.story.content_arabic.slice(0, 30_000),
      storyTitle: prepared.story.title_arabic,
      difficulty: prepared.story.difficulty,
      gradeLevel: prepared.story.grade_level
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in teacher auto-grading API:', error)
    if (error instanceof GroqConfigurationError) {
      return NextResponse.json(
        { error: 'خدمة الذكاء الاصطناعي غير مهيأة. يرجى إضافة GROQ_API_KEY.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'تعذر إكمال التقييم التلقائي' }, { status: 500 })
  }
}
