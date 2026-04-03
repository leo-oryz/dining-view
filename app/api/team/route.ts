import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const profile = await getSession()

  if (!profile) {
    return NextResponse.json(
      { success: false, data: null, error: 'Not authenticated', timestamp: new Date().toISOString() },
      { status: 401 }
    )
  }

  if (profile.role !== 'owner') {
    return NextResponse.json(
      { success: false, data: null, error: 'Forbidden', timestamp: new Date().toISOString() },
      { status: 403 }
    )
  }

  const supabase = createServiceClient()

  const { data: members, error } = await supabase
    .from('users')
    .select(`
      id,
      email,
      name,
      display_name,
      role,
      store_id,
      is_active,
      invited_by,
      invited_at,
      created_at,
      auth_id
    `)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }

  // Fetch store names for display
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')

  const storeMap = new Map((stores || []).map(s => [s.id, s.name]))

  const enriched = (members || []).map(m => ({
    ...m,
    store_name: m.store_id ? storeMap.get(m.store_id) || null : null,
  }))

  return NextResponse.json({
    success: true,
    data: enriched,
    error: null,
    timestamp: new Date().toISOString(),
  })
}
