type HistoricalWeatherDay = {
  date: string
  temp_high: number | null
  temp_low: number | null
  humidity: number | null
  precipitation: number | null
  weather_code: string | null
  description: string | null
}

// WMO Weather Code to Chinese description
function wmoCodeToDescription(code: number): string {
  const map: Record<number, string> = {
    0: '晴',
    1: '大致晴', 2: '多雲', 3: '陰',
    45: '霧', 48: '霧',
    51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨',
    56: '凍雨', 57: '凍雨',
    61: '小雨', 63: '中雨', 65: '大雨',
    66: '凍雨', 67: '凍雨',
    71: '小雪', 73: '中雪', 75: '大雪',
    77: '雪', 80: '陣雨', 81: '陣雨', 82: '大陣雨',
    85: '陣雪', 86: '大陣雪',
    95: '雷雨', 96: '雷雨伴冰雹', 99: '雷雨伴冰雹',
  }
  return map[code] ?? '多雲'
}

// Ho Chi Minh City (NOM Dining) — overridable via OPENWEATHER_LAT / OPENWEATHER_LON.
const DEFAULT_LAT = Number(process.env.OPENWEATHER_LAT ?? 10.8231)
const DEFAULT_LON = Number(process.env.OPENWEATHER_LON ?? 106.6297)

/**
 * Fetch historical daily weather from Open-Meteo (free, no API key).
 * Uses HCM City coordinates by default.
 */
export async function fetchHistoricalWeather(
  startDate: string,
  endDate: string,
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON
): Promise<HistoricalWeatherDay[]> {
  // Open-Meteo archive API for past dates, forecast API for recent/today
  const today = new Date().toISOString().slice(0, 10)
  const results: HistoricalWeatherDay[] = []

  // Split into archive range and forecast range
  const archiveEnd = endDate < today ? endDate : (() => {
    const d = new Date()
    d.setDate(d.getDate() - 5)
    return d.toISOString().slice(0, 10)
  })()
  const forecastStart = archiveEnd < endDate ? (() => {
    const d = new Date(archiveEnd)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })() : null

  const params = `latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,weather_code&timezone=Asia%2FHo_Chi_Minh`

  // Fetch archive data
  if (startDate <= archiveEnd) {
    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?${params}&start_date=${startDate}&end_date=${archiveEnd}`
    const archiveData = await fetchAndParse(archiveUrl)
    results.push(...archiveData)
  }

  // Fetch recent/forecast data for the last few days
  if (forecastStart && forecastStart <= endDate) {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?${params}&start_date=${forecastStart}&end_date=${endDate}&past_days=0`
    const forecastData = await fetchAndParse(forecastUrl)
    results.push(...forecastData)
  }

  return results
}

async function fetchAndParse(url: string): Promise<HistoricalWeatherDay[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[Open-Meteo] HTTP ${res.status}:`, text)
    throw new Error(`Open-Meteo API returned ${res.status}`)
  }

  const json = await res.json()
  const daily = json.daily

  if (!daily?.time?.length) {
    return []
  }

  const days: HistoricalWeatherDay[] = []
  for (let i = 0; i < daily.time.length; i++) {
    const wmoCode = daily.weather_code?.[i] ?? null
    days.push({
      date: daily.time[i],
      temp_high: daily.temperature_2m_max?.[i] ?? null,
      temp_low: daily.temperature_2m_min?.[i] ?? null,
      humidity: daily.relative_humidity_2m_mean?.[i] ?? null,
      precipitation: daily.precipitation_sum?.[i] ?? null,
      weather_code: wmoCode != null ? String(wmoCode) : null,
      description: wmoCode != null ? wmoCodeToDescription(wmoCode) : null,
    })
  }

  return days
}
