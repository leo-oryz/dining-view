import { SupabaseClient } from '@supabase/supabase-js'

export interface ProductPair {
  product_a: string
  product_b: string
  co_occurrence: number
}

export interface ProductPairResult extends ProductPair {
  support_pct: number
}

/**
 * Find top product pairs that appear together in the same order.
 * Uses order_items grouped by order_number.
 *
 * When startDate/endDate are provided, uses that range.
 * Otherwise falls back to the last `days` days (default 90).
 */
export async function getTopProductPairs(
  supabase: SupabaseClient,
  storeId: string,
  options?: {
    days?: number
    limit?: number
    startDate?: string
    endDate?: string
  }
): Promise<{ pairs: ProductPairResult[]; total_orders: number }> {
  const { days = 90, limit = 20, startDate, endDate } = options ?? {}

  let sinceStr: string
  if (startDate) {
    sinceStr = startDate
  } else {
    const since = new Date()
    since.setDate(since.getDate() - days)
    sinceStr = since.toISOString().slice(0, 10)
  }

  // Get all order items grouped by order
  let query = supabase
    .from('order_items')
    .select('order_number, item_name')
    .eq('store_id', storeId)
    .gte('date', sinceStr)
    .not('item_name', 'is', null)
    .not('order_number', 'is', null)

  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data: items, error } = await query

  if (error || !items || items.length === 0) return { pairs: [], total_orders: 0 }

  // Group items by order
  const orders = new Map<string, Set<string>>()
  for (const item of items) {
    if (!item.order_number || !item.item_name) continue
    if (!orders.has(item.order_number)) {
      orders.set(item.order_number, new Set())
    }
    orders.get(item.order_number)!.add(item.item_name)
  }

  const totalOrders = orders.size

  // Count co-occurrences
  const pairCounts = new Map<string, number>()
  for (const itemSet of Array.from(orders.values())) {
    const products = Array.from(itemSet).sort()
    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const key = `${products[i]}|||${products[j]}`
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
      }
    }
  }

  // Sort by count descending, take top N
  const sorted = Array.from(pairCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  const pairs = sorted.map(([key, count]) => {
    const [a, b] = key.split('|||')
    return {
      product_a: a,
      product_b: b,
      co_occurrence: count,
      support_pct: totalOrders > 0 ? count / totalOrders : 0,
    }
  })

  return { pairs, total_orders: totalOrders }
}
