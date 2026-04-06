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
  const { member_id } = body

  if (!member_id) {
    return NextResponse.json(
      { success: false, data: null, error: 'member_id is required', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Get the member
  const { data: member, error: fetchError } = await supabase
    .from('users')
    .select('id, email, auth_id')
    .eq('id', member_id)
    .single()

  if (fetchError || !member) {
    return NextResponse.json(
      { success: false, data: null, error: 'Member not found', timestamp: new Date().toISOString() },
      { status: 404 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin') || ''
  const redirectTo = `${siteUrl}/auth-callback?type=invite`

  // Delete old auth user and re-invite to bypass rate limits on the same user
  if (member.auth_id) {
    await supabase.auth.admin.deleteUser(member.auth_id)
  }

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(member.email, {
    redirectTo,
  })

  if (inviteError) {
    const msg = inviteError.message.includes('rate limit')
      ? '寄信頻率超過限制，請稍後再試（Supabase 預設每小時 4 封）'
      : inviteError.message
    return NextResponse.json(
      { success: false, data: null, error: msg, timestamp: new Date().toISOString() },
      { status: 429 }
    )
  }

  // Update auth_id in users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ auth_id: inviteData.user.id, invited_at: new Date().toISOString() })
    .eq('id', member_id)

  if (updateError) {
    return NextResponse.json(
      { success: false, data: null, error: updateError.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data: { email: member.email },
    error: null,
    timestamp: new Date().toISOString(),
  })
}
