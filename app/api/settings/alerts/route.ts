import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    const supabase = createServiceClient()
    const url = new URL(request.url)
    const storeId = getStoreId(url.searchParams)

    const { data, error } = await supabase
      .from('alert_settings')
      .select('*')
      .eq('store_id', storeId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return apiError(error.message, 500)
    }

    // Return defaults if no settings exist
    return apiSuccess(data || { alert_emails: [], is_enabled: true })
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createServiceClient()
    const url = new URL(request.url)
    const storeId = getStoreId(url.searchParams)
    const body = await request.json()

    const { alert_emails, is_enabled } = body

    if (!Array.isArray(alert_emails)) {
      return apiError('alert_emails must be an array', 400)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of alert_emails) {
      if (!emailRegex.test(email)) {
        return apiError(`Invalid email: ${email}`, 400)
      }
    }

    const { data, error } = await supabase
      .from('alert_settings')
      .upsert({
        store_id: storeId,
        alert_emails,
        is_enabled: is_enabled ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id' })
      .select()
      .single()

    if (error) {
      return apiError(error.message, 500)
    }

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
