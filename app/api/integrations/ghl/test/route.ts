import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { fetchCampaigns } from '@/lib/integrations/gohighlevel/client'

async function run(apiKey?: string) {
  try {
    const campaigns = await fetchCampaigns(apiKey ? { apiKey } : undefined)
    return { success: true, detail: `Connection OK — ${campaigns.length} campaigns visible` }
  } catch (err) {
    return { success: false, detail: err instanceof Error ? err.message : 'Test failed' }
  }
}

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const result = await run()
  return apiSuccess(result)
}

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const body = await request.json().catch(() => ({}))
  const apiKey = typeof body.api_key === 'string' && body.api_key.trim() ? body.api_key.trim() : undefined
  const result = await run(apiKey)
  return apiSuccess(result)
}
