import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEmployees } from '@/lib/integrations/betterhr/client'

const KEY_API = 'betterhr_api_key'
const KEY_COMPANY = 'betterhr_company_id'

async function resolveCreds(body: { store_id?: string; api_key?: string; company_id?: string }) {
  const fromBody = {
    apiKey: body.api_key?.trim() || undefined,
    companyId: body.company_id?.trim() || undefined,
  }
  const storeId = body.store_id?.trim()
  if (!storeId || (fromBody.apiKey && fromBody.companyId)) return fromBody

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .in('setting_key', [KEY_API, KEY_COMPANY])
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.setting_value) map.set(row.setting_key as string, row.setting_value as string)
  }
  return {
    apiKey: fromBody.apiKey ?? map.get(KEY_API),
    companyId: fromBody.companyId ?? map.get(KEY_COMPANY),
  }
}

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const creds = await resolveCreds(body)

  try {
    const employees = await fetchEmployees({
      apiKey: creds.apiKey,
      companyId: creds.companyId,
    })
    return apiSuccess({ success: true, employeeCount: employees.length })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Test connection failed', 500)
  }
}
