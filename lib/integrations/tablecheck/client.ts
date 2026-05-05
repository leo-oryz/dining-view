import type { TableCheckListResponse, TableCheckReservation } from './types'

const TABLECHECK_BASE = 'https://api.tablecheck.com/api/booking/v1'

export async function fetchReservations(params: {
  shopId: string
  startAtMin: string // ISO8601 with TZ offset
  startAtMax: string
  page?: number
}): Promise<{
  reservations: TableCheckReservation[]
  hasNextPage: boolean
  nextPage: number | null
}> {
  const url = new URL(`${TABLECHECK_BASE}/reservations`)
  url.searchParams.set('shop_id', params.shopId)
  url.searchParams.set('start_at_min', params.startAtMin)
  url.searchParams.set('start_at_max', params.startAtMax)
  url.searchParams.set('page', String(params.page ?? 1))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.TABLECHECK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`TableCheck API error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as TableCheckListResponse
  const nextPage = data.next_page ?? data.meta?.next_page ?? null

  return {
    reservations: data.reservations ?? data.data ?? [],
    hasNextPage: !!nextPage,
    nextPage,
  }
}

export async function fetchAllReservations(params: {
  shopId: string
  startAtMin: string
  startAtMax: string
}): Promise<TableCheckReservation[]> {
  const all: TableCheckReservation[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const result = await fetchReservations({ ...params, page })
    all.push(...result.reservations)
    hasMore = result.hasNextPage
    if (!hasMore) break
    page = result.nextPage ?? page + 1
  }

  return all
}
