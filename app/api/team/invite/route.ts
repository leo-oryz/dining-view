import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { email, role, store_id, display_name } = body

  if (!email || !role) {
    return NextResponse.json(
      { success: false, data: null, error: 'email and role are required', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const validRoles = ['owner', 'manager', 'marketing', 'investor']
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { success: false, data: null, error: `Invalid role. Must be one of: ${validRoles.join(', ')}`, timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  if (role === 'manager' && !store_id) {
    return NextResponse.json(
      { success: false, data: null, error: 'store_id is required for manager role', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Check if email already exists in users table
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return NextResponse.json(
      { success: false, data: null, error: 'This email is already registered', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  // Use NEXT_PUBLIC_SITE_URL for reliable redirect in production
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin') || ''
  const redirectTo = `${siteUrl}/callback?type=invite`

  // Send invite via Supabase Auth
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  })

  if (inviteError) {
    const msg = inviteError.message.includes('rate limit')
      ? '寄信頻率超過限制，請稍後再試（Supabase 預設每小時 4 封）'
      : inviteError.message
    return NextResponse.json(
      { success: false, data: null, error: msg, timestamp: new Date().toISOString() },
      { status: inviteError.message.includes('rate limit') ? 429 : 500 }
    )
  }

  // Create user record in users table
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      email,
      auth_id: inviteData.user.id,
      role,
      store_id: store_id || null,
      display_name: display_name || null,
      name: display_name || null,
      invited_by: profile.id,
      invited_at: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json(
      { success: false, data: null, error: insertError.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data: newUser,
    error: null,
    timestamp: new Date().toISOString(),
  })
}
