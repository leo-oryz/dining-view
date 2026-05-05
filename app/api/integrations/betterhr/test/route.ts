import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { fetchEmployees } from '@/lib/integrations/betterhr/client'

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const body = await request.json().catch(() => ({}))
  const apiKey = body.api_key as string | undefined
  const companyId = body.company_id as string | undefined

  try {
    const employees = await fetchEmployees({
      apiKey: apiKey || undefined,
      companyId: companyId || undefined,
    })
    return apiSuccess({ success: true, employeeCount: employees.length })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Test connection failed', 500)
  }
}
