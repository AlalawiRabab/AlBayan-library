import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'
import { generateTeacherFeedback, GradingQuestion, GroqConfigurationError } from '@/lib/groq'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PreparedFeedback = {
  questions: GradingQuestion[]
  answers: Record<string, string>
  studentName: string
  story: {
    title_arabic: string
    content_arabic: string
    difficulty: string
    grade_level: number
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > 4_000) return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })

  let body: Record<string, unknown>
  try {
    const rawBody = await request.text()
    if (rawBody.length > 4_000) return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }

  const teacherAccessCode = typeof body.teacherAccessCode === 'string' ? body.teacherAccessCode.trim() : ''
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
  const grade = body.grade === undefined || body.grade === null || body.grade === '' ? undefined : Number(body.grade)
  if (
    !teacherAccessCode ||
    teacherAccessCode.length > 64 ||
    !UUID_PATTERN.test(submissionId) ||
    (grade !== undefined && (!Number.isInteger(grade) || grade < 0 || grade > 100))
  ) {
    return NextResponse.json({ error: 'طلب إنشاء التعليق غير صالح' }, { status: 400 })
  }

  let prepared: PreparedFeedback
  try {
    prepared = await callAutoGradingGateway<PreparedFeedback>({
      action: 'prepare_teacher',
      teacherAccessCode,
      submissionId
    })
  } catch (error) {
    if (error instanceof AutoGradingGatewayError) {
      if (error.status === 429) return NextResponse.json({ error: 'تم تجاوز عدد المحاولات. يرجى الانتظار قليلاً.' }, { status: 429 })
      if (error.status >= 400 && error.status < 500) return NextResponse.json({ error: 'غير مصرح بعرض هذه الإجابة' }, { status: error.status })
    }
    console.error('Teacher feedback authorization failed:', error)
    return NextResponse.json({ error: 'تعذر تجهيز التعليق' }, { status: 500 })
  }

  try {
    const feedback = await generateTeacherFeedback({
      questions: prepared.questions,
      answers: prepared.answers,
      storyContent: prepared.story.content_arabic.slice(0, 30_000),
      storyTitle: prepared.story.title_arabic,
      difficulty: prepared.story.difficulty,
      gradeLevel: prepared.story.grade_level,
      studentName: prepared.studentName,
      teacherGrade: grade
    })
    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Error generating feedback:', error)
    if (error instanceof GroqConfigurationError) {
      return NextResponse.json(
        { error: 'خدمة الذكاء الاصطناعي غير مهيأة. يرجى إضافة GROQ_API_KEY.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'تعذر إنشاء التعليق' }, { status: 500 })
  }
}

