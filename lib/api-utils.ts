import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001'
const ACTIVE_STORE_COOKIE = 'active_store_id'

export function apiSuccess(data: unknown) {
  return NextResponse.json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  })
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({
    success: false,
    data: null,
    error: message,
    timestamp: new Date().toISOString(),
  }, { status })
}

export function getStoreId(searchParams: URLSearchParams): string {
  const fromQuery = searchParams.get('store_id')
  if (fromQuery) return fromQuery
  try {
    const fromCookie = cookies().get(ACTIVE_STORE_COOKIE)?.value
    if (fromCookie) return fromCookie
  } catch {
    // cookies() requires request scope; fall through to default in other contexts
  }
  return DEFAULT_STORE_ID
}

export { DEFAULT_STORE_ID, ACTIVE_STORE_COOKIE }
