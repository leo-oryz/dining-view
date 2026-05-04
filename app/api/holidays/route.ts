import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const supabase = createServiceClient()

    if (params.get('upcoming') === 'true') {
      const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const horizon = new Date(Date.now() + (7 + 30) * 60 * 60 * 1000)
      // 30 days from "today" in HCM
      horizon.setUTCDate(horizon.getUTCDate() + 29)
      const horizonIso = horizon.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', today)
        .lte('date', horizonIso)
        .order('date', { ascending: true })

      if (error) return apiError(error.message, 500)
      return apiSuccess(data ?? [])
    }

    const countryCode = params.get('country_code')
    const yearParam = params.get('year')
    if (!countryCode || !yearParam) {
      return apiError('country_code and year are required (or pass upcoming=true)', 400)
    }
    const year = Number(yearParam)
    if (!Number.isFinite(year)) return apiError('Invalid year', 400)

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('country_code', countryCode)
      .eq('year', year)
      .order('date', { ascending: true })

    if (error) return apiError(error.message, 500)
    return apiSuccess(data ?? [])
  } catch {
    return apiError('Internal server error', 500)
  }
}
