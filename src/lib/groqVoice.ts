import 'server-only'
import { getGroqClient, GroqConfigurationError, GroqTimeoutError } from '@/lib/groq'
import { gradeReadingTranscript, VoiceGradeResult } from '@/lib/voiceGradingLogic'
import {
  assertTrustedSignedAudioUrl,
  isAllowedAudioExtension,
  MAX_VOICE_BYTES
} from '@/lib/voiceAudioGuard'

export { MAX_VOICE_BYTES, assertTrustedSignedAudioUrl } from '@/lib/voiceAudioGuard'

/**
 * Whisper wall-clock budget. Kept below route maxDuration (60s) and below
 * parallel text timeout so download(15s)+Whisper(20s) fits with headroom.
 */
export const GROQ_VOICE_TIMEOUT_MS = 20_000
export const VOICE_DOWNLOAD_TIMEOUT_MS = 15_000

const ALLOWED_AUDIO_MIME_PREFIXES = [
  'audio/',
  'video/mp4',
  'video/webm',
  'application/octet-stream'
]

export class VoiceGradingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VoiceGradingError'
  }
}

function withTimeout<T>(ms: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return operation(controller.signal)
    .catch(error => {
      if (
        controller.signal.aborted
        || (error instanceof Error && (error.name === 'AbortError' || /aborted|timeout/i.test(error.message)))
      ) {
        throw new GroqTimeoutError()
      }
      throw error
    })
    .finally(() => clearTimeout(timer))
}

function extensionFromName(name: string) {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

function isAllowedMime(mime: string) {
  const normalized = mime.toLowerCase()
  return ALLOWED_AUDIO_MIME_PREFIXES.some(prefix =>
    prefix.endsWith('/') ? normalized.startsWith(prefix) : normalized === prefix
  )
}

export async function downloadTrustedAudio(signedUrl: string, supabaseUrl: string): Promise<{
  bytes: Uint8Array
  contentType: string
  fileName: string
}> {
  const host = new URL(supabaseUrl).host
  const parsed = assertTrustedSignedAudioUrl(signedUrl, host)
  const response = await withTimeout(VOICE_DOWNLOAD_TIMEOUT_MS, signal => fetch(parsed.toString(), { method: 'GET', signal, redirect: 'error' }))
  if (!response.ok) throw new VoiceGradingError('Audio download failed')

  const contentType = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim()
  if (!isAllowedMime(contentType)) throw new VoiceGradingError('Unsupported audio type')

  const contentLength = Number(response.headers.get('content-length') || '0')
  if (contentLength > MAX_VOICE_BYTES) throw new VoiceGradingError('Audio too large')

  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_VOICE_BYTES) {
    throw new VoiceGradingError('Audio size invalid')
  }

  const pathPart = decodeURIComponent(parsed.pathname.split('/').pop() || 'recording.webm')
  const extension = extensionFromName(pathPart)
  if (extension && !isAllowedAudioExtension(extension)) {
    throw new VoiceGradingError('Unsupported audio extension')
  }

  return {
    bytes: buffer,
    contentType,
    fileName: pathPart.includes('.') ? pathPart : `recording.${extension || 'webm'}`
  }
}

type VerboseTranscription = {
  text?: unknown
  duration?: unknown
  segments?: Array<{ no_speech_prob?: unknown; text?: unknown }>
}

export async function transcribeArabicAudio(file: File): Promise<{ text: string; duration: number | null }> {
  const groq = getGroqClient()
  const result = await withTimeout(GROQ_VOICE_TIMEOUT_MS, signal =>
    groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'ar',
      temperature: 0,
      response_format: 'verbose_json'
      // Intentionally no prompt — avoid biasing Whisper toward the story text.
    }, { signal })
  ) as VerboseTranscription

  const text = typeof result.text === 'string' ? result.text.trim() : ''
  const duration = Number.isFinite(Number(result.duration)) ? Number(result.duration) : null
  const segments = Array.isArray(result.segments) ? result.segments : []
  const mostlySilent = segments.length > 0
    && segments.every(segment => Number(segment.no_speech_prob) >= 0.7)

  if (!text || mostlySilent || (duration !== null && duration < 1)) {
    throw new VoiceGradingError('Unusable transcription')
  }

  return { text, duration }
}

export async function gradeStudentVoiceRecording(options: {
  signedAudioUrl: string
  supabaseUrl: string
  storyContent: string
  /** When set, signed path must include this story UUID (prepare_audio_upload layout). */
  expectedStoryId?: string
}): Promise<VoiceGradeResult | null> {
  try {
    const audio = await downloadTrustedAudio(options.signedAudioUrl, options.supabaseUrl)
    if (options.expectedStoryId) {
      const path = new URL(options.signedAudioUrl).pathname
      const marker = `/voice-recordings/`
      const idx = path.indexOf(marker)
      if (idx < 0) throw new VoiceGradingError('Untrusted recording prefix')
      const relative = decodeURIComponent(path.slice(idx + marker.length))
      // Modern: {studentId}/{storyId}/{uuid}.ext — story segment must match.
      const segments = relative.split('/')
      if (segments.length >= 2 && segments[1] !== options.expectedStoryId) {
        throw new VoiceGradingError('Audio story mismatch')
      }
      // Legacy flat name: {accessCode}_{storyId}_{n}.ext
      if (segments.length === 1 && !relative.includes(`_${options.expectedStoryId}_`)) {
        throw new VoiceGradingError('Audio story mismatch')
      }
    }
    const blob = new Blob([Buffer.from(audio.bytes)], { type: audio.contentType })
    const file = new File([blob], audio.fileName, { type: audio.contentType })
    const { text } = await transcribeArabicAudio(file)
    return gradeReadingTranscript(options.storyContent, text)
  } catch (error) {
    if (
      error instanceof GroqConfigurationError
      || error instanceof GroqTimeoutError
      || error instanceof VoiceGradingError
    ) {
      console.error('Voice auto-grading unavailable; leaving voice_grade unset')
      return null
    }
    console.error('Voice auto-grading failed; leaving voice_grade unset')
    return null
  }
}
