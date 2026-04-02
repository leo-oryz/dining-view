type WeatherData = {
  date: string
  temp_high: number | null
  temp_low: number | null
  humidity: number | null
  precipitation: number | null
  weather_code: string | null
  description: string | null
}

type CwaResponse = {
  success: string
  records: {
    Station: Array<{
      StationId: string
      WeatherElement: Array<{
        ElementName: string
        Time: Array<{
          DataTime: string
          ElementValue: Array<{
            Value: string
          }>
        }>
      }>
    }>
  }
}

export async function fetchDailyWeather(date: string): Promise<WeatherData | null> {
  const apiKey = process.env.CWA_API_KEY
  const stationId = process.env.CWA_STATION_ID || '466920'

  if (!apiKey) {
    console.warn('[Weather] CWA_API_KEY not set, skipping')
    return null
  }

  const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001?Authorization=${encodeURIComponent(apiKey)}&StationId=${stationId}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!res.ok) {
      console.warn(`[Weather] CWA API returned ${res.status}`)
      return null
    }

    const json: CwaResponse = await res.json()

    if (json.success !== 'true' || !json.records?.Station?.length) {
      console.warn('[Weather] No station data in CWA response')
      return null
    }

    const station = json.records.Station[0]
    const elements = station.WeatherElement

    const getValue = (name: string): string | null => {
      const el = elements.find((e) => e.ElementName === name)
      if (!el?.Time?.[0]?.ElementValue?.[0]?.Value) return null
      const val = el.Time[0].ElementValue[0].Value
      return val === '-99' || val === '-999' ? null : val
    }

    const temp = getValue('TEMP')
    const humd = getValue('HUMD')
    const rain = getValue('RAIN')
    const weather = getValue('Weather')

    return {
      date,
      temp_high: temp ? parseFloat(temp) : null,
      temp_low: temp ? parseFloat(temp) : null,
      humidity: humd ? parseFloat(humd) * 100 : null,
      precipitation: rain ? parseFloat(rain) : null,
      weather_code: null,
      description: weather,
    }
  } catch (err) {
    console.warn('[Weather] CWA API error:', err)
    return null
  }
}
