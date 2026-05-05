import { createHash } from 'crypto'
import type { TableCheckReservation } from './types'

function hashPII(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  return createHash('sha256').update(trimmed).digest('hex')
}

const STATUS_MAP: Record<string, string> = {
  confirmed: 'confirmed',
  reserved: 'confirmed',
  seated: 'seated',
  completed: 'completed',
  finished: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  no_show: 'no_show',
  noshow: 'no_show',
}

function normalizeStatus(status: string | undefined | null): string {
  const lc = status?.toLowerCase() ?? ''
  return STATUS_MAP[lc] ?? lc ?? 'unknown'
}

export function transformReservation(raw: TableCheckReservation, storeId: string) {
  const status = normalizeStatus(raw.status)
  return {
    store_id: storeId,
    tablecheck_id: raw.id,
    reserved_at: raw.start_at,
    party_size: raw.pax ?? 1,
    status,
    source_channel: raw.source ?? null,
    guest_country: raw.guest?.country ?? null,
    guest_name_hash: hashPII(raw.guest?.name),
    guest_phone_hash: hashPII(raw.guest?.phone),
    no_show: status === 'no_show',
    cancelled_at: raw.cancelled_at ?? null,
    seated_at: raw.seated_at ?? null,
    completed_at: raw.completed_at ?? null,
    memo: raw.memo ?? null,
    raw_payload: raw,
    updated_at: new Date().toISOString(),
  }
}
