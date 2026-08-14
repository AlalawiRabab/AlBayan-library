import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_REQUEST_LENGTH = 2_000

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > MAX_REQUEST_LENGTH) return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })

  let body: Record<string, unknown>
  try {
    const rawBody = await request.text()
    if (rawBody.length > MAX_REQUEST_LENGTH) return NextResponse.json({ error: 'حجم الطلب كبير جداً' }, { status: 413 })
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
  }

  const adminAccessCode = typeof body.adminAccessCode === 'string' ? body.adminAccessCode.trim() : ''
  const operation = body.operation === 'update_name' || body.operation === 'toggle_status' || body.operation === 'delete'
    ? body.operation
    : null
  const gradeId = Number(body.gradeId)
  const name = typeof body.name === 'string' ? body.name.trim() : undefined

  if (
    !adminAccessCode || adminAccessCode.length > 64 || !operation ||
    !Number.isInteger(gradeId) || gradeId < 1 || gradeId > 100 ||
    (operation === 'update_name' && (!name || name.length > 120)) ||
    (operation === 'toggle_status' && typeof body.isActive !== 'boolean')
  ) {
    return NextResponse.json({ error: 'طلب إدارة الصف غير صالح' }, { status: 400 })
  }

  try {
    const result = await callAutoGradingGateway<Record<string, unknown>>({
      action: 'admin_grade_mutation',
      adminAccessCode,
      operation,
      gradeId,
      name,
      isActive: body.isActive
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AutoGradingGatewayError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ error: 'غير مصرح بإدارة هذا الصف' }, { status: error.status })
    }
    console.error('Admin grade mutation failed:', error)
    return NextResponse.json({ error: 'تعذر تحديث الصف' }, { status: 500 })
  }
}
