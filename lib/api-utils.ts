import { NextResponse } from 'next/server'

const DEFAULT_STORE_ID = '36d016c4-7584-4c0f-a3e8-9562089d57f8'

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
  return searchParams.get('store_id') || DEFAULT_STORE_ID
}

export { DEFAULT_STORE_ID }
