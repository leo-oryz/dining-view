import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ENV } from './env'

export interface StoreCreds {
  id: string
  name: string
  ipos_email: string
  ipos_password: string
  ipos_brand_uid: string | null
  ipos_company_uid: string | null
}

interface StoreRow {
  id: string
  name: string
  credentials: Partial<Record<string, Record<string, string>>> | null
}

export function getServiceClient(): SupabaseClient {
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function loadStoresWithIposCreds(
  supabase: SupabaseClient,
  onlyStoreId: string | null,
): Promise<StoreCreds[]> {
  let q = supabase.from('stores').select('id,name,credentials')
  if (onlyStoreId) q = q.eq('id', onlyStoreId)
  const { data, error } = await q

  if (error) throw new Error(`Failed to load stores: ${error.message}`)

  const stores: StoreCreds[] = []
  for (const row of (data ?? []) as StoreRow[]) {
    const ipos = row.credentials?.ipos
    const email = ipos?.email?.trim()
    const password = ipos?.password?.trim()
    if (!email || !password) continue
    stores.push({
      id: row.id,
      name: row.name,
      ipos_email: email,
      ipos_password: password,
      ipos_brand_uid: ipos?.brand_uid?.trim() || null,
      ipos_company_uid: ipos?.company_uid?.trim() || null,
    })
  }

  return stores
}
