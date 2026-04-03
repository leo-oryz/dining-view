import { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

/**
 * Fetch all rows from a Supabase query using pagination,
 * bypassing the PostgREST default max_rows (1000) limit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any

export async function paginatedFetch<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  options: {
    select?: string
    filters?: (query: QueryBuilder) => QueryBuilder
    order?: { column: string; ascending?: boolean }
  } = {}
): Promise<{ data: T[]; error: string | null }> {
  const allRows: T[] = []
  let offset = 0

  while (true) {
    let query = supabase
      .from(table)
      .select(options.select || '*')

    if (options.filters) {
      query = options.filters(query)
    }

    if (options.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending ?? false })
    }

    query = query.range(offset, offset + PAGE_SIZE - 1)

    const { data, error } = await query

    if (error) {
      return { data: allRows, error: error.message }
    }

    if (!data || data.length === 0) break

    allRows.push(...(data as T[]))

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { data: allRows, error: null }
}
