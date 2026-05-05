// Shared weather utilities — all modules import from here

export interface WeatherDaily {
  date: string
  temp_high: number | null
  temp_low: number | null
  humidity: number | null
  precipitation: number | null
  weather_code: string | null
  description: string | null
}

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'heavy_rain' | 'typhoon' | 'other'

export const WEATHER_ICONS: Record<WeatherType, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧',
  heavy_rain: '⛈',
  typhoon: '🌀',
  other: '🌤',
}

export const WEATHER_LABELS: Record<WeatherType, string> = {
  sunny: '晴天',
  cloudy: '多雲',
  rainy: '雨天',
  heavy_rain: '大雨',
  typhoon: '颱風',
  other: '其他',
}

/**
 * Map weather description + precipitation to a weather type.
 *
 * Descriptions come from Open-Meteo (mapped from WMO codes to Chinese in openMeteoClient)
 * or OpenWeatherMap (English). Typhoon detection targets Vietnamese tropical storms (bão):
 * WMO doesn't have a typhoon-specific code, so we treat severe thunderstorms (95/96/99)
 * combined with extreme precipitation, or daily rain ≥ 80mm, as typhoon-equivalent.
 */
export function getWeatherType(day: WeatherDaily): WeatherType {
  const desc = (day.description ?? '').toLowerCase()
  const precip = day.precipitation ?? 0
  const code = day.weather_code ?? ''

  // Typhoon / tropical storm (bão): explicit description, or severe thunderstorm + heavy rain,
  // or extreme daily precipitation (>= 80mm/day is a strong signal in southern Vietnam).
  if (
    desc.includes('颱') ||
    desc.includes('bão') ||
    desc.includes('typhoon') ||
    precip >= 80 ||
    ((code === '95' || code === '96' || code === '99') && precip >= 30)
  ) {
    return 'typhoon'
  }

  // Heavy rain: by precipitation threshold or description
  if (precip > 50 || desc.includes('大雨') || desc.includes('豪雨') || desc.includes('heavy rain')) return 'heavy_rain'

  // Rain
  if (desc.includes('雨') || precip > 1) return 'rainy'

  // Cloudy / overcast
  if (desc.includes('陰') || desc.includes('多雲') || desc.includes('雲')) return 'cloudy'

  // Sunny / clear
  if (desc.includes('晴') || desc.includes('清')) return 'sunny'

  return 'other'
}

export function getWeatherIcon(type: WeatherType | string): string {
  return WEATHER_ICONS[type as WeatherType] ?? WEATHER_ICONS.other
}

export function isTyphoon(day: WeatherDaily): boolean {
  return getWeatherType(day) === 'typhoon'
}

export function isRainy(day: WeatherDaily): boolean {
  const t = getWeatherType(day)
  return t === 'rainy' || t === 'heavy_rain'
}

/**
 * Format a one-line weather summary.
 * e.g. "🌧 雨天 28°C / 22°C 雨量 15mm"
 */
export function formatWeatherSummary(day: WeatherDaily): string {
  const type = getWeatherType(day)
  const icon = getWeatherIcon(type)
  const label = WEATHER_LABELS[type]

  const parts: string[] = [`${icon} ${label}`]

  if (day.temp_high !== null && day.temp_low !== null) {
    if (day.temp_high === day.temp_low) {
      parts.push(`${day.temp_high}°C`)
    } else {
      parts.push(`${day.temp_high}°C / ${day.temp_low}°C`)
    }
  } else if (day.temp_high !== null) {
    parts.push(`${day.temp_high}°C`)
  }

  if (day.precipitation !== null && day.precipitation > 0) {
    parts.push(`雨量 ${day.precipitation}mm`)
  }

  return parts.join('  ')
}

/**
 * Filter out typhoon days from a list of dates.
 * Used by KOL and LINE impact calculations.
 */
export function excludeTyphoonDays(
  dates: string[],
  weatherMap: Map<string, WeatherDaily>
): string[] {
  return dates.filter((d) => {
    const w = weatherMap.get(d)
    return !w || !isTyphoon(w)
  })
}

/**
 * Build a Map<date, WeatherDaily> from an array for quick lookups.
 */
export function buildWeatherMap(rows: WeatherDaily[]): Map<string, WeatherDaily> {
  const map = new Map<string, WeatherDaily>()
  for (const row of rows) {
    map.set(row.date, row)
  }
  return map
}
