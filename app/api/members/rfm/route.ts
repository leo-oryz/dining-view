import { apiSuccess, apiError } from '@/lib/api-utils'

export async function GET() {
  try {
    return apiSuccess([])
  } catch {
    return apiError('Internal server error', 500)
  }
}
