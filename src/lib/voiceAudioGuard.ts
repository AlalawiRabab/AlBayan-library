export const MAX_VOICE_BYTES = 10 * 1024 * 1024

const ALLOWED_AUDIO_EXTENSIONS = new Set(['webm', 'mp3', 'mp4', 'aac', 'ogg', 'm4a', 'wav'])

export function isAllowedAudioExtension(extension: string) {
  return ALLOWED_AUDIO_EXTENSIONS.has(extension.toLowerCase())
}

const UUID_IN_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Signed URLs must target bucket `student-recordings` under `voice-recordings/`.
 * Modern prepare_audio_upload path: voice-recordings/{studentId}/{storyId}/{uuid}.ext
 */
export function assertTrustedSignedAudioUrl(signedUrl: string, supabaseHost: string) {
  let parsed: URL
  try {
    parsed = new URL(signedUrl)
  } catch {
    throw new Error('Invalid signed audio URL')
  }
  if (parsed.protocol !== 'https:' || parsed.host !== supabaseHost) {
    throw new Error('Untrusted audio host')
  }
  const path = parsed.pathname
  if (
    !path.includes('/storage/v1/object/sign/student-recordings/')
    && !path.includes('/storage/v1/object/authenticated/student-recordings/')
  ) {
    throw new Error('Untrusted audio path')
  }
  const marker = '/voice-recordings/'
  const idx = path.indexOf(marker)
  if (idx < 0) {
    throw new Error('Untrusted recording prefix')
  }
  const relative = decodeURIComponent(path.slice(idx + marker.length))
  const segments = relative.split('/').filter(Boolean)
  if (segments.length >= 3) {
    const [studentId, storyId, fileName] = segments
    if (!UUID_IN_PATH.test(studentId) || !UUID_IN_PATH.test(storyId)) {
      throw new Error('Untrusted recording ownership path')
    }
    if (!/^[0-9a-f-]{36}\.(webm|mp3|mp4|aac|ogg|m4a|wav)$/i.test(fileName)) {
      throw new Error('Untrusted recording filename')
    }
  } else if (segments.length === 1) {
    // Legacy flat object under voice-recordings/
    if (!/^.+_[0-9a-f-]{36}_\d+\.(webm|mp3|mp4|aac|ogg|m4a|wav)$/i.test(segments[0])) {
      throw new Error('Untrusted legacy recording name')
    }
  } else {
    throw new Error('Untrusted recording path shape')
  }
  return parsed
}

/** Pure helper for selftests: modern path ownership layout. */
export function isOwnedModernVoicePath(objectPath: string, studentId: string, storyId: string) {
  const prefix = `voice-recordings/${studentId}/${storyId}/`
  if (!objectPath.startsWith(prefix)) return false
  const fileName = objectPath.slice(prefix.length)
  return /^[0-9a-f-]{36}\.(webm|mp3|mp4|aac|ogg|m4a|wav)$/i.test(fileName)
}
