export type KolPlatform = 'instagram' | 'facebook' | 'tiktok' | 'threads' | 'youtube'

interface DetectionResult {
  platform: KolPlatform
  url: string
}

interface DetectionError {
  error: string
}

const PLATFORM_PATTERNS: { pattern: RegExp; platform: KolPlatform }[] = [
  { pattern: /instagram\.com/i, platform: 'instagram' },
  { pattern: /facebook\.com/i, platform: 'facebook' },
  { pattern: /tiktok\.com/i, platform: 'tiktok' },
  { pattern: /threads\.net/i, platform: 'threads' },
  { pattern: /youtube\.com/i, platform: 'youtube' },
  { pattern: /youtu\.be/i, platform: 'youtube' },
]

export function detectPlatform(url: string): DetectionResult | DetectionError {
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

  return {
    error: '無法辨識平台，支援：Instagram、Facebook、TikTok、Threads、YouTube',
  }
}

export function isDetectionError(result: DetectionResult | DetectionError): result is DetectionError {
  return 'error' in result
}
