import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { APP_TIMEZONE } from '@/lib/constants/timezone'

const STORE_SELECT_FIELDS = 'id, name, location, timezone, is_active, created_at, phone, business_hours, opened_date, google_maps_url, google_place_id, seat_count, manager_name, manager_email, tablecheck_shop_id'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('stores')
      .select(STORE_SELECT_FIELDS)
      .order('is_active', { ascending: false })
      .order('name')

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name) {
      return apiError('Store name is required', 400)
    }

    const supabase = createServiceClient()

    const row = {
      name: body.name,
      location: body.location || null,
      timezone: body.timezone || APP_TIMEZONE,
      is_active: true,
      credentials: body.credentials || {},
      phone: body.phone || null,
      business_hours: body.business_hours || null,
      opened_date: body.opened_date || null,
      google_maps_url: body.google_maps_url || null,
      google_place_id: body.google_place_id || null,
      seat_count: body.seat_count || null,
      manager_name: body.manager_name || null,
      manager_email: body.manager_email || null,
    }

    const { data, error } = await supabase
      .from('stores')
      .insert(row)
      .select(STORE_SELECT_FIELDS)
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
