import type {
  BetterHREmployee,
  BetterHRAttendance,
  BetterHRPayroll,
  BetterHRLeave,
  BetterHRListResponse,
} from './types'

// ⚠️ verify base URL against BetterHR API docs once credentials arrive.
// BetterHR is a Singapore-based HRIS; v1 path is the most common convention.
const BETTERHR_BASE = process.env.BETTERHR_BASE_URL ?? 'https://api.betterhr.com/v1'

export interface BetterHRConfig {
  apiKey?: string
  companyId?: string
}

function getConfig(override?: BetterHRConfig): BetterHRConfig {
  return {
    apiKey: override?.apiKey ?? process.env.BETTERHR_API_KEY,
    companyId: override?.companyId ?? process.env.BETTERHR_COMPANY_ID,
  }
}

function isConfigured(cfg: BetterHRConfig): boolean {
  return !!(cfg.apiKey && cfg.apiKey.trim() && cfg.companyId && cfg.companyId.trim())
}

async function betterhrFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cfg: BetterHRConfig,
): Promise<BetterHRListResponse<T>> {
  if (!isConfigured(cfg)) {
    console.warn('[BetterHR] API key or company ID not set — returning empty result.')
    return { data: [] }
  }

  const url = new URL(`${BETTERHR_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'X-Company-Id': cfg.companyId!,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    throw new Error(`BetterHR API error: ${res.status} ${await res.text()}`)
  }

  return (await res.json()) as BetterHRListResponse<T>
}

function pickList<T>(resp: BetterHRListResponse<T>): T[] {
  return resp.data ?? resp.results ?? resp.items ?? []
}

async function fetchAllPages<T>(
  path: string,
  baseParams: Record<string, string | number | undefined>,
  cfg: BetterHRConfig,
): Promise<T[]> {
  const out: T[] = []
  let page = 1
  while (true) {
    const resp = await betterhrFetch<T>(path, { ...baseParams, page }, cfg)
    const list = pickList(resp)
    out.push(...list)
    const next = resp.next_page ?? resp.meta?.next_page ?? null
    if (!next || list.length === 0) break
    page = next
    // safety guard — bail out at 100 pages
    if (page > 100) break
  }
  return out
}

// ============================================================
// Public API — every fn returns [] if credentials are missing
// ============================================================

// ⚠️ verify endpoint paths against BetterHR API docs
export async function fetchEmployees(
  override?: BetterHRConfig,
): Promise<BetterHREmployee[]> {
  const cfg = getConfig(override)
  if (!isConfigured(cfg)) return []
  return fetchAllPages<BetterHREmployee>('/employees', {}, cfg)
}

// ⚠️ verify endpoint path + query params (date filters often use start/end or from/to)
export async function fetchAttendance(
  params: { startDate: string; endDate: string },
  override?: BetterHRConfig,
): Promise<BetterHRAttendance[]> {
  const cfg = getConfig(override)
  if (!isConfigured(cfg)) return []
  return fetchAllPages<BetterHRAttendance>(
    '/attendance',
    { start_date: params.startDate, end_date: params.endDate },
    cfg,
  )
}

// ⚠️ verify — payroll APIs often use a `period` (YYYY-MM) param
export async function fetchPayroll(
  params: { period: string },
  override?: BetterHRConfig,
): Promise<BetterHRPayroll[]> {
  const cfg = getConfig(override)
  if (!isConfigured(cfg)) return []
  return fetchAllPages<BetterHRPayroll>('/payroll', { period: params.period }, cfg)
}

// ⚠️ verify endpoint
export async function fetchLeave(
  params: { startDate: string; endDate: string },
  override?: BetterHRConfig,
): Promise<BetterHRLeave[]> {
  const cfg = getConfig(override)
  if (!isConfigured(cfg)) return []
  return fetchAllPages<BetterHRLeave>(
    '/leave',
    { start_date: params.startDate, end_date: params.endDate },
    cfg,
  )
}

export function isBetterHRConfigured(override?: BetterHRConfig): boolean {
  return isConfigured(getConfig(override))
}
