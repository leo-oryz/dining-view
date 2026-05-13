import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import type { CredentialsSchema, Provider } from '@/lib/integrations/credentials'

// Build a GET handler that reads stores.credentials.<provider> for one store
// and returns masked info: { has_<field>, <field>_last4 } for secret fields
// and the raw value for plain fields.
export function makeCredentialsGet<P extends Provider>(
  provider: P,
  secretFields: ReadonlyArray<keyof CredentialsSchema[P]>,
  plainFields: ReadonlyArray<keyof CredentialsSchema[P]> = [],
) {
  return async function GET(request: NextRequest) {
    const profile = await getSession()
    if (!profile) return apiError('Unauthorized', 401)
    if (profile.role !== 'owner') return apiError('Forbidden', 403)

    const storeId = request.nextUrl.searchParams.get('store_id')
    if (!storeId) return apiError('store_id is required', 400)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('stores')
      .select('credentials')
      .eq('id', storeId)
      .single<{ credentials: Record<string, Record<string, string>> | null }>()

    if (error) return apiError(error.message, 500)
    const creds = (data?.credentials?.[provider] ?? {}) as Record<string, string>

    const out: Record<string, unknown> = {}
    for (const f of secretFields) {
      const v = creds[f as string] ?? null
      out[`has_${String(f)}`] = !!v
      out[`${String(f)}_last4`] = v ? v.slice(-4) : null
    }
    for (const f of plainFields) {
      out[String(f)] = creds[f as string] ?? null
    }
    return apiSuccess(out)
  }
}

// Build a PUT handler that writes stores.credentials.<provider> for one store.
// Merges with existing — empty/blank fields are skipped (won't overwrite).
export function makeCredentialsPut<P extends Provider>(
  provider: P,
  allFields: ReadonlyArray<keyof CredentialsSchema[P]>,
) {
  return async function PUT(request: NextRequest) {
    const profile = await getSession()
    if (!profile) return apiError('Unauthorized', 401)
    if (profile.role !== 'owner') return apiError('Forbidden', 403)

    const body = await request.json().catch(() => ({}))
    const storeId = typeof body.store_id === 'string' ? body.store_id : null
    if (!storeId) return apiError('store_id is required', 400)

    const incoming: Record<string, string> = {}
    for (const f of allFields) {
      const v = body[String(f)]
      if (typeof v === 'string' && v.trim()) incoming[String(f)] = v.trim()
    }

    if (Object.keys(incoming).length === 0) return apiSuccess({ saved: 0 })

    const supabase = createServiceClient()
    const { data: existing, error: readErr } = await supabase
      .from('stores')
      .select('credentials')
      .eq('id', storeId)
      .single<{ credentials: Record<string, Record<string, string>> | null }>()
    if (readErr) return apiError(readErr.message, 500)

    const merged = { ...(existing?.credentials ?? {}) }
    merged[provider] = { ...(merged[provider] ?? {}), ...incoming }

    const { error: writeErr } = await supabase
      .from('stores')
      .update({ credentials: merged })
      .eq('id', storeId)
    if (writeErr) return apiError(writeErr.message, 500)

    return apiSuccess({ saved: Object.keys(incoming).length })
  }
}
