import { NextRequest, NextResponse } from 'next/server'
import { callAutoGradingGateway, AutoGradingGatewayError } from '@/lib/autoGradingGateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  const adminAccessCode = typeof body.adminAccessCode === 'string' ? body.adminAccessCode.trim() : ''
  const resource = body.resource === 'overview' || body.resource === 'grade_submissions' ? body.resource : null
  const gradeLevel = body.gradeLevel === undefined ? undefined : Number(body.gradeLevel)
  if (
    !adminAccessCode || adminAccessCode.length > 64 || !resource ||
    (resource === 'grade_submissions' && (!Number.isInteger(gradeLevel) || gradeLevel! < 1 || gradeLevel! > 100))
  ) {
    return NextResponse.json({ error: 'طلب بيانات المسؤول غير صالح' }, { status: 400 })
  }

  try {
    const result = await callAutoGradingGateway<Record<string, unknown>>({
      action: 'admin_data',
      adminAccessCode,
      resource,
      gradeLevel
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AutoGradingGatewayError && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ error: 'غير مصرح بعرض هذه البيانات' }, { status: error.status })
    }
    console.error('Admin data request failed:', error)
    return NextResponse.json({ error: 'تعذر تحميل بيانات المسؤول' }, { status: 500 })
  }
}
