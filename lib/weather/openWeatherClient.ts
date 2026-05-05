type WeatherData = {
  date: string
  temp_high: number | null
  temp_low: number | null
  humidity: number | null
  precipitation: number | null
  weather_code: string | null
  description: string | null
}

interface OWMCurrent {
  weather?: { id: number; main: string; description: string }[]
  main?: { temp?: number; temp_min?: number; temp_max?: number; humidity?: number }
  rain?: { '1h'?: number; '3h'?: number }
}

const DEFAULT_LAT = Number(process.env.OPENWEATHER_LAT ?? 10.8231)
const DEFAULT_LON = Number(process.env.OPENWEATHER_LON ?? 106.6297)

/**
 * Fetch the current day's weather snapshot from OpenWeatherMap (HCM City by default).
 * Returns null if the API key is missing or the call fails — callers must handle null.
 */
export async function fetchDailyWeather(date: string): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    console.warn('[Weather] OPENWEATHER_API_KEY not set, skipping')
    return null
  }

  const lat = DEFAULT_LAT
  const lon = DEFAULT_LON
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(apiKey)}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      console.warn(`[Weather] OpenWeatherMap returned ${res.status}`)
      return null
    }
    const json: OWMCurrent = await res.json()
    const w = json.weather?.[0]
    const precip = json.rain?.['1h'] ?? json.rain?.['3h'] ?? 0

    return {
      date,
      temp_high: json.main?.temp_max ?? json.main?.temp ?? null,
      temp_low: json.main?.temp_min ?? json.main?.temp ?? null,
      humidity: json.main?.humidity ?? null,
      precipitation: precip,
      weather_code: w?.id != null ? String(w.id) : null,
      description: w?.description ?? w?.main ?? null,
    }
  } catch (err) {
    console.warn('[Weather] OpenWeatherMap error:', err)
    return null
  }
}
