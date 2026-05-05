import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

function getMondayIso(date: Date): string {
  const d = new Date(date)
  const dayOfWeek = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - ((dayOfWeek + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const airport = params.get('airport') ?? process.env.AVIATIONSTACK_AIRPORT ?? 'SGN'
    const weeks = Math.max(1, Math.min(12, Number(params.get('weeks')) || 4))

    const supabase = createServiceClient()
    const start = getMondayIso(new Date())
    const end = new Date(`${start}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 7 * weeks - 1)
    const endIso = end.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('flight_capacity')
      .select('*')
      .eq('arrival_airport', airport)
      .gte('week_start', start)
      .lte('week_start', endIso)
      .order('week_start', { ascending: true })
      .order('origin_country', { ascending: true })

    if (error) return apiError(error.message, 500)
    return apiSuccess(data ?? [])
  } catch {
    return apiError('Internal server error', 500)
  }
}
