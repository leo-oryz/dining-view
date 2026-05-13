import type { SupabaseClient } from '@supabase/supabase-js'

// Per-store credential schema. Each top-level key is a `provider` slug stored
// under `stores.credentials` JSONB. Add a provider here when introducing a new
// integration; required fields are validated at read time via REQUIRED_FIELDS.
export interface CredentialsSchema {
  meta_ads: { access_token: string; account_id: string }
  tiktok_ads: { access_token: string; advertiser_id: string }
  ga4: { property_id: string }
  gsc: { site_url: string }
  line: { channel_access_token: string; channel_secret?: string }
  tablecheck: { api_key: string }
  ipos: { email: string; password: string; brand_uid?: string; company_uid?: string }
  ghl: { api_key: string; location_id?: string }
  instagram: { access_token: string; account_id?: string }
  cloudbeds: { api_key: string; property_id: string }
}

export type Provider = keyof CredentialsSchema

const REQUIRED_FIELDS: { [P in Provider]: ReadonlyArray<keyof CredentialsSchema[P]> } = {
  meta_ads: ['access_token', 'account_id'],
  tiktok_ads: ['access_token', 'advertiser_id'],
  ga4: ['property_id'],
  gsc: ['site_url'],
  line: ['channel_access_token'],
  tablecheck: ['api_key'],
  ipos: ['email', 'password'],
  ghl: ['api_key'],
  instagram: ['access_token'],
  cloudbeds: ['api_key', 'property_id'],
}

export class MissingCredentialsError extends Error {
  constructor(
    public readonly storeId: string,
    public readonly provider: Provider,
    public readonly missing: ReadonlyArray<string>,
  ) {
    super(`Missing ${provider} credentials for store ${storeId}: ${missing.join(', ')}`)
    this.name = 'MissingCredentialsError'
  }
}

type StoreCredentialsRow = { credentials: Partial<Record<Provider, Record<string, string>>> | null }

// Strict read: throws MissingCredentialsError if any required field is empty.
// Use this in API routes / scripts where the caller has chosen a specific store
// and an unconfigured store is a real failure.
export async function getStoreCredentials<P extends Provider>(
  supabase: SupabaseClient,
  storeId: string,
  provider: P,
): Promise<CredentialsSchema[P]> {
  const { data, error } = await supabase
    .from('stores')
    .select('credentials')
    .eq('id', storeId)
    .single<StoreCredentialsRow>()

  if (error) throw new Error(`Failed to load credentials for store ${storeId}: ${error.message}`)
  if (!data) throw new Error(`Store ${storeId} not found`)

  const creds = (data.credentials?.[provider] ?? {}) as Record<string, string>
  const missing = REQUIRED_FIELDS[provider].filter(f => !creds[f as string]?.trim())
  if (missing.length > 0) {
    throw new MissingCredentialsError(storeId, provider, missing as ReadonlyArray<string>)
  }

  return creds as unknown as CredentialsSchema[P]
}

// Soft read: returns null if the store has no credentials for this provider.
// Use this in cron jobs that iterate every store — unconfigured stores should
// be skipped, not abort the whole job.
export async function tryGetStoreCredentials<P extends Provider>(
  supabase: SupabaseClient,
  storeId: string,
  provider: P,
): Promise<CredentialsSchema[P] | null> {
  try {
    return await getStoreCredentials(supabase, storeId, provider)
  } catch (e) {
    if (e instanceof MissingCredentialsError) return null
    throw e
  }
}
