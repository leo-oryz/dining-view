export type KolPlatform = 'instagram' | 'facebook' | 'tiktok' | 'threads' | 'youtube' | 'blogger'

interface DetectionResult {
  platform: KolPlatform
  url: string
}

interface DetectionUnknown {
  platform: null
  url: string
}

interface DetectionError {
  error: string
}

export type DetectionOutput = DetectionResult | DetectionUnknown | DetectionError

const PLATFORM_PATTERNS: { pattern: RegExp; platform: KolPlatform }[] = [
  { pattern: /instagram\.com/i, platform: 'instagram' },
  { pattern: /facebook\.com/i, platform: 'facebook' },
  { pattern: /tiktok\.com/i, platform: 'tiktok' },
  { pattern: /threads\.net/i, platform: 'threads' },
  { pattern: /youtube\.com/i, platform: 'youtube' },
  { pattern: /youtu\.be/i, platform: 'youtube' },
  // Common blog platforms
  { pattern: /pixnet\.net/i, platform: 'blogger' },
  { pattern: /wordpress\.com/i, platform: 'blogger' },
  { pattern: /blogger\.com/i, platform: 'blogger' },
  { pattern: /medium\.com/i, platform: 'blogger' },
  { pattern: /vocus\.cc/i, platform: 'blogger' },
]

/**
 * Detect platform from URL.
 * Returns { platform, url } if detected, { platform: null, url } if valid URL but unknown platform,
 * or { error } if the URL is invalid.
 */
export function detectPlatform(url: string): DetectionOutput {
  const trimmed = url.trim()

  try {
    new URL(trimmed)
  } catch {
    return { error: '無效的網址格式' }
  }

  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { platform, url: trimmed }
    }
  }

  // Valid URL but unknown platform — let caller decide (manual selection)
  return { platform: null, url: trimmed }
}

export function isDetectionError(result: DetectionOutput): result is DetectionError {
  return 'error' in result
}

export function isDetected(result: DetectionOutput): result is DetectionResult {
  return !isDetectionError(result) && result.platform !== null
}
