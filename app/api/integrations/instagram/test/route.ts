import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { fetchIGProfile } from '@/lib/integrations/social/instagram/client'
import { fetchFBProfile } from '@/lib/integrations/social/facebook/client'

interface TestBody {
  ig_token?: string
  ig_user_id?: string
  fb_token?: string
  fb_page_id?: string
}

async function run(body: TestBody) {
  const detail: string[] = []
  let success = true
  try {
    const ig = await fetchIGProfile({
      accessToken: body.ig_token?.trim() || undefined,
      igUserId: body.ig_user_id?.trim() || undefined,
    })
    if (ig?.id) {
      detail.push(`Instagram OK — @${ig.username ?? ig.id}, ${ig.followers_count ?? 0} followers`)
    } else {
      detail.push('Instagram: not configured')
    }
  } catch (err) {
    success = false
    detail.push(`Instagram error: ${err instanceof Error ? err.message : 'unknown'}`)
  }
  try {
    const fb = await fetchFBProfile({
      accessToken: body.fb_token?.trim() || undefined,
      pageId: body.fb_page_id?.trim() || undefined,
    })
    if (fb?.id) {
      const followers = fb.followers_count ?? fb.fan_count ?? 0
      detail.push(`Facebook OK — ${fb.name ?? fb.id}, ${followers} followers`)
    } else {
      detail.push('Facebook: not configured')
    }
  } catch (err) {
    success = false
    detail.push(`Facebook error: ${err instanceof Error ? err.message : 'unknown'}`)
  }
  return { success, detail: detail.join(' · ') }
}

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const result = await run({})
  return apiSuccess(result)
}

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const body = (await request.json().catch(() => ({}))) as TestBody
  const result = await run(body)
  return apiSuccess(result)
}
