import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'
import { VOICE_ATTEMPTS_EXHAUSTED_MESSAGE } from '@/lib/voiceAttemptLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const studentAccessCode = typeof body.studentAccessCode === 'string' ? body.studentAccessCode.trim() : ''
  const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : ''

  if (!studentAccessCode || studentAccessCode.length > 64 || !UUID_PATTERN.test(storyId)) {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }

  try {
    const status = await callAutoGradingGateway<{
      attemptsRemaining: number
      attemptsUsed: number
      maxAttempts: number
      limitReached: boolean
    }>({
      action: 'voice_attempt_status',
      studentAccessCode,
      storyId
    })

    return NextResponse.json({
      attemptsRemaining: status.attemptsRemaining,
      attemptsUsed: status.attemptsUsed,
      maxAttempts: status.maxAttempts,
      limitReached: status.limitReached,
      message: status.limitReached
        ? VOICE_ATTEMPTS_EXHAUSTED_MESSAGE
        : undefined
    })
  } catch (error) {
    if (error instanceof AutoGradingGatewayError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ error: 'تعذر التحقق من بيانات الطالب أو القصة' }, { status: error.status })
    }
    console.error('Voice attempt status failed')
    return NextResponse.json({ error: 'تعذر جلب حالة المحاولات الصوتية' }, { status: 500 })
  }
}
