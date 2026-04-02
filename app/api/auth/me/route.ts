import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/getSession'

export async function GET() {
  const profile = await getSession()

  if (!profile) {
    return NextResponse.json(
      { success: false, data: null, error: 'Not authenticated', timestamp: new Date().toISOString() },
      { status: 401 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      store_id: profile.store_id,
    },
    error: null,
    timestamp: new Date().toISOString(),
  })
}
