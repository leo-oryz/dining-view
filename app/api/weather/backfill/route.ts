import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchHistoricalWeather } from '@/lib/weather/openMeteoClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const startDate = body.start_date || '2025-11-01'
    const endDate = body.end_date || new Date().toISOString().slice(0, 10)

    const supabase = createServiceClient()

    // Get all active stores
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

    // Fetch historical weather from Open-Meteo
    const weatherDays = await fetchHistoricalWeather(startDate, endDate)

    if (weatherDays.length === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'No weather data returned from Open-Meteo',
        timestamp: new Date().toISOString(),
      })
    }

    // Build upsert rows for all stores x all days
    const rows = stores.flatMap((store) =>
      weatherDays.map((day) => ({
        store_id: store.id,
        date: day.date,
        temp_high: day.temp_high,
        temp_low: day.temp_low,
        humidity: day.humidity,
        precipitation: day.precipitation,
        weather_code: day.weather_code,
        description: day.description,
      }))
    )

    // Upsert in batches of 500 to avoid payload limits
    const batchSize = 500
    let upserted = 0
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const { error } = await supabase
        .from('weather_daily')
        .upsert(batch, { onConflict: 'store_id,date' })

      if (error) {
        return NextResponse.json({
          success: false,
          data: { upserted_so_far: upserted },
          error: error.message,
          timestamp: new Date().toISOString(),
        }, { status: 500 })
      }
      upserted += batch.length
    }

    return NextResponse.json({
      success: true,
      data: {
        start_date: startDate,
        end_date: endDate,
        days: weatherDays.length,
        stores: stores.length,
        total_rows: rows.length,
      },
      error: null,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Weather Backfill]', err)
    return NextResponse.json({
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
