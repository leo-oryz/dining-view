import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllReservations } from './client'
import { transformReservation } from './transformer'
import { tryGetStoreCredentials } from '@/lib/integrations/credentials'

// Asia/Ho_Chi_Minh is a fixed +07:00 offset (no DST), so we hardcode it
// instead of pulling in date-fns-tz.
const APP_TZ_OFFSET = '+07:00'

function ymdInVN(d: Date): string {
  // Convert UTC instant → VN local Y-M-D by shifting by +7h, then slicing.
  const shifted = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

export interface SyncResult {
  store: string
  store_id: string
  synced?: number
  error?: string
}

export async function syncAllStores(options?: {
  daysBack?: number
  daysForward?: number
}): Promise<SyncResult[]> {
  const daysBack = options?.daysBack ?? 7
  const daysForward = options?.daysForward ?? 30
  const supabase = createServiceClient()

  const { data: stores, error: storesErr } = await supabase
    .from('stores')
    .select('id, name, tablecheck_shop_id')
    .not('tablecheck_shop_id', 'is', null)

  if (storesErr) throw storesErr
  if (!stores?.length) return []

  const now = new Date()
  const startMin = new Date(now)
  startMin.setUTCDate(startMin.getUTCDate() - daysBack)
  const startMax = new Date(now)
  startMax.setUTCDate(startMax.getUTCDate() + daysForward)

  const startAtMin = `${ymdInVN(startMin)}T00:00:00${APP_TZ_OFFSET}`
  const startAtMax = `${ymdInVN(startMax)}T23:59:59${APP_TZ_OFFSET}`

  const results: SyncResult[] = []

  for (const store of stores) {
    const shopId = store.tablecheck_shop_id as string
    try {
      const creds = await tryGetStoreCredentials(supabase, store.id, 'tablecheck')
      if (!creds) {
        results.push({
          store: store.name,
          store_id: store.id,
          error: 'no tablecheck.api_key credential',
        })
        continue
      }
      const raw = await fetchAllReservations({
        apiKey: creds.api_key,
        shopId,
        startAtMin,
        startAtMax,
      })

      const rows = raw.map((r) => transformReservation(r, store.id))

      if (rows.length > 0) {
        const { error } = await supabase
          .from('reservations')
          .upsert(rows, {
            onConflict: 'store_id,tablecheck_id',
            ignoreDuplicates: false,
          })
        if (error) throw error
      }

      results.push({ store: store.name, store_id: store.id, synced: rows.length })
    } catch (err) {
      results.push({
        store: store.name,
        store_id: store.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}
