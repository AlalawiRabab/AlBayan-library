/**
 * Conservative Arabic normalization for reading accuracy comparison.
 * Avoid aggressive stem/lemma merges that could falsely inflate scores.
 */
export function normalizeArabicForReading(text: string): string {
  return text
    .normalize('NFKC')
    // Remove tatweel and Arabic diacritics / Quranic marks commonly used in vocalization.
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // Unify common alef forms only.
    .replace(/[إأآٱ]/g, 'ا')
    // Drop punctuation and non-Arabic letters while keeping Arabic letters, digits, and spaces.
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/[a-zA-Z]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeArabicWords(text: string): string[] {
  const normalized = normalizeArabicForReading(text)
  if (!normalized) return []
  return normalized.split(' ').filter(Boolean)
}
