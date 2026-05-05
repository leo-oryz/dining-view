import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchDailyWeather } from '@/lib/weather/openWeatherClient'

export async function POST() {
  try {
    const supabase = createServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    // CWA observation API returns current/today's data
    const weather = await fetchDailyWeather(today)

    if (!weather) {
      const hasKey = !!process.env.OPENWEATHER_API_KEY
      return NextResponse.json({
        success: false,
        data: null,
        error: hasKey
          ? 'OpenWeatherMap returned no data — check server log'
          : 'OPENWEATHER_API_KEY not set — configure it and restart',
        timestamp: new Date().toISOString(),
      })
    }

    // Get all stores and insert weather for each
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .eq('is_active', true)

    if (!stores || stores.length === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'No active stores found',
        timestamp: new Date().toISOString(),
      })
    }

    const rows = stores.map((store) => ({
      store_id: store.id,
      date: today,
      temp_high: weather.temp_high,
      temp_low: weather.temp_low,
      humidity: weather.humidity,
      precipitation: weather.precipitation,
      weather_code: weather.weather_code,
      description: weather.description,
    }))

    const { error: upsertError } = await supabase
      .from('weather_daily')
      .upsert(rows, { onConflict: 'store_id,date' })

    if (upsertError) {
      return NextResponse.json({
        success: false,
        data: null,
        error: upsertError.message,
        timestamp: new Date().toISOString(),
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { date: today, stores: stores.length },
      error: null,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Weather Sync]', err)
    return NextResponse.json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
