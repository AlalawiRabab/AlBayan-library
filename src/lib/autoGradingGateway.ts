import 'server-only'

const EDGE_FUNCTION_NAME = 'secure-auto-grading'

export class AutoGradingGatewayError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'AutoGradingGatewayError'
    this.status = status
  }
}

export async function callAutoGradingGateway<T>(payload: Record<string, unknown>): Promise<T> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const sharedSecret = process.env.AUTO_GRADING_RPC_SECRET?.trim()

  if (!supabaseUrl || !anonKey || !sharedSecret) {
    throw new AutoGradingGatewayError('Secure auto-grading configuration is missing', 503)
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${EDGE_FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'x-auto-grading-secret': sharedSecret
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000)
  })

  let result: Record<string, unknown> = {}
  try {
    result = await response.json() as Record<string, unknown>
  } catch {
    throw new AutoGradingGatewayError('Secure auto-grading service returned an invalid response', 502)
  }

  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : 'Secure auto-grading request failed'
    throw new AutoGradingGatewayError(message, response.status)
  }

  return result as T
}
