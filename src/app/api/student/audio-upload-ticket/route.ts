import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const AUDIO_EXTENSIONS = new Set(['webm', 'mp3', 'mp4', 'aac', 'ogg'])
const AUDIO_CONTENT_TYPES = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'video/mp4',
  'application/octet-stream'
])

type UploadTicket = {
  path: string
  token: string
  publicUrl: string
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > 2_000) return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })

  let body: Record<string, unknown>
  try {
    const rawBody = await request.text()
    if (rawBody.length > 2_000) return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }

  const studentAccessCode = typeof body.studentAccessCode === 'string' ? body.studentAccessCode.trim() : ''
  const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : ''
  const extension = typeof body.extension === 'string' ? body.extension.trim().toLowerCase() : ''
  const contentType = typeof body.contentType === 'string' ? body.contentType.trim().toLowerCase() : ''

  if (
    !studentAccessCode || studentAccessCode.length > 64 || !UUID_PATTERN.test(storyId) ||
    !AUDIO_EXTENSIONS.has(extension) || !AUDIO_CONTENT_TYPES.has(contentType)
  ) {
    return NextResponse.json({ error: 'طلب رفع التسجيل غير صالح' }, { status: 400 })
  }

  try {
    const ticket = await callAutoGradingGateway<UploadTicket>({
      action: 'prepare_audio_upload',
      studentAccessCode,
      storyId,
      extension,
      contentType
    })
    return NextResponse.json(ticket)
  } catch (error) {
    if (error instanceof AutoGradingGatewayError) {
      if (error.status === 429) {
        return NextResponse.json({ error: 'تم تجاوز عدد محاولات رفع التسجيل. يرجى الانتظار قليلاً.' }, { status: 429 })
      }
      if (error.status === 403) {
        const limitReached = /voice grading attempt limit/i.test(error.message)
        return NextResponse.json(
          {
            error: limitReached
              ? 'تم استخدام محاولتي التقييم الصوتي لهذه القصة'
              : 'غير مصرح برفع هذا التسجيل',
            code: limitReached ? 'voice_attempt_limit_reached' : undefined
          },
          { status: 403 }
        )
      }
      if (error.status >= 400 && error.status < 500) {
        return NextResponse.json({ error: 'غير مصرح برفع هذا التسجيل' }, { status: error.status })
      }
    }
    console.error('Audio upload authorization failed')
    return NextResponse.json({ error: 'تعذر تجهيز رفع التسجيل الصوتي' }, { status: 500 })
  }
}
