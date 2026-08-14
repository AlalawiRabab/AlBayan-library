import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > 2_000) {
    return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    const rawBody = await request.text()
    if (rawBody.length > 2_000) {
      return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
    }
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }

  const teacherAccessCode = typeof body.teacherAccessCode === 'string' ? body.teacherAccessCode.trim() : ''
  if (!teacherAccessCode || teacherAccessCode.length > 64) {
    return NextResponse.json({ error: 'رمز المعلمة غير صالح' }, { status: 400 })
  }

  try {
    const result = await callAutoGradingGateway<{ submissions: unknown[] }>({
      action: 'teacher_submissions',
      teacherAccessCode
    })
    return NextResponse.json(result.submissions)
  } catch (error) {
    if (error instanceof AutoGradingGatewayError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ error: 'غير مصرح بعرض الإجابات' }, { status: error.status })
    }
    console.error('Teacher submissions request failed:', error)
    return NextResponse.json({ error: 'تعذر تحميل الإجابات' }, { status: 500 })
  }
}
