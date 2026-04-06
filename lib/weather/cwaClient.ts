type WeatherData = {
  date: string
  temp_high: number | null
  temp_low: number | null
  humidity: number | null
  precipitation: number | null
  weather_code: string | null
  description: string | null
}

interface CwaStationElement {
  Weather: string
  Now: { Precipitation: string }
  AirTemperature: string
  RelativeHumidity: string
  DailyExtreme: {
    DailyHigh: { TemperatureInfo: { AirTemperature: string } }
    DailyLow: { TemperatureInfo: { AirTemperature: string } }
  }
}

interface CwaStation {
  StationName: string
  StationId: string
  ObsTime: { DateTime: string }
  WeatherElement: CwaStationElement
}

interface CwaResponse {
  success: string
  records: {
    Station: CwaStation[]
  }
}

function safeFloat(val: string | null | undefined): number | null {
  if (!val || val === '-99' || val === '-999' || val === '-99.0') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
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
    const we = station.WeatherElement

    const tempHigh = safeFloat(we.DailyExtreme?.DailyHigh?.TemperatureInfo?.AirTemperature)
    const tempLow = safeFloat(we.DailyExtreme?.DailyLow?.TemperatureInfo?.AirTemperature)
    const tempCurrent = safeFloat(we.AirTemperature)

    return {
      date,
      temp_high: tempHigh ?? tempCurrent,
      temp_low: tempLow ?? tempCurrent,
      humidity: safeFloat(we.RelativeHumidity),
      precipitation: safeFloat(we.Now?.Precipitation),
      weather_code: null,
      description: we.Weather || null,
    }
  } catch (err) {
    console.warn('[Weather] CWA API error:', err)
    return null
  }
}
