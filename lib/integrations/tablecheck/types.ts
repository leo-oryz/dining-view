// Field names are best-guess based on TableCheck conventions.
// Verify against actual API response on first sync and adjust transformer accordingly.
export interface TableCheckReservation {
  id: string
  shop_id: string
  start_at: string // ISO8601
  pax: number
  status: string // 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'
  source?: string
  guest?: {
    name?: string
    phone?: string
    country?: string // ISO 3166-1 alpha-2 (e.g. 'VN', 'KR', 'CN')
    locale?: string
  }
  memo?: string
  created_at?: string
  updated_at?: string
  cancelled_at?: string
  seated_at?: string
  completed_at?: string
}

export interface TableCheckListResponse {
  reservations?: TableCheckReservation[]
  data?: TableCheckReservation[]
  next_page?: number | null
  meta?: { next_page?: number | null }
}
