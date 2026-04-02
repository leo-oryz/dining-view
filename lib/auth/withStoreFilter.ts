import { getSession, UserProfile } from './getSession'

type StoreFilterResult =
  | { authorized: true; profile: UserProfile; storeIds: string[] | null }
  | { authorized: false; profile: null; storeIds: null }

/**
 * Returns the store IDs the current user is allowed to access.
 * - owner: storeIds = null (meaning all stores)
 * - manager: storeIds = [their store_id]
 * - unauthenticated: authorized = false
 */
export async function withStoreFilter(): Promise<StoreFilterResult> {
  const profile = await getSession()

  if (!profile) {
    return { authorized: false, profile: null, storeIds: null }
  }

  if (profile.role === 'owner') {
    return { authorized: true, profile, storeIds: null }
  }

  if (!profile.store_id) {
    return { authorized: false, profile: null, storeIds: null }
  }

  return { authorized: true, profile, storeIds: [profile.store_id] }
}

/**
 * Build a Supabase query filter for store_id.
 * If storeIds is null (owner), no filter is applied.
 * If a specific requestedStoreId is provided, it must be in the allowed list.
 */
export function applyStoreFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  storeIds: string[] | null,
  requestedStoreId?: string | null
) {
  if (requestedStoreId) {
    // If user requests a specific store, verify they have access
    if (storeIds !== null && !storeIds.includes(requestedStoreId)) {
      return null // unauthorized
    }
    return query.eq('store_id', requestedStoreId)
  }

  // No specific store requested — filter by allowed stores
  if (storeIds !== null) {
    if (storeIds.length === 1) {
      return query.eq('store_id', storeIds[0])
    }
    return query.in('store_id', storeIds)
  }

  return query // owner sees all
}
