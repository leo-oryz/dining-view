import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

const STORE_SELECT_FIELDS = 'id, name, location, timezone, is_active, created_at, phone, business_hours, opened_date, google_maps_url, google_place_id, seat_count, manager_name, manager_email'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getSession()
  if (!profile) return apiError('Not authenticated', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const { id } = await params

  try {
    const body = await request.json()
    const supabase = createServiceClient()

    const update: Record<string, unknown> = {}
    const allowedFields = [
      'name', 'location', 'timezone', 'phone', 'business_hours',
      'opened_date', 'google_maps_url', 'google_place_id',
      'seat_count', 'manager_name', 'manager_email',
    ]

    for (const field of allowedFields) {
      if (field in body) {
        update[field] = body[field] || null
      }
    }

    // name is required — don't allow setting to null
    if ('name' in body) {
      if (!body.name?.trim()) return apiError('Store name is required', 400)
      update.name = body.name.trim()
    }

    // Handle credentials: merge, only update fields that are provided
    if (body.credentials) {
      const { data: existing } = await supabase
        .from('stores')
        .select('credentials')
        .eq('id', id)
        .single()

      const merged = { ...(existing?.credentials || {}) }
      for (const [provider, creds] of Object.entries(body.credentials)) {
        if (creds && typeof creds === 'object') {
          const c = creds as Record<string, string>
          // Only update if user provided actual values (not empty strings)
          if (c.email || c.password) {
            merged[provider] = { ...(merged[provider] || {}), ...c }
            // Remove empty string values
            for (const k of Object.keys(merged[provider])) {
              if (!merged[provider][k]) delete merged[provider][k]
            }
          }
        }
      }
      update.credentials = merged
    }

    if (Object.keys(update).length === 0) {
      return apiError('No fields to update', 400)
    }

    const { data, error } = await supabase
      .from('stores')
      .update(update)
      .eq('id', id)
      .select(STORE_SELECT_FIELDS)
      .single()

    if (error) return apiError(error.message, 500)
    if (!data) return apiError('Store not found', 404)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
