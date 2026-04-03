import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params

  // Prevent owner from disabling themselves
  if (id === profile.id) {
    return NextResponse.json(
      { success: false, data: null, error: 'Cannot disable your own account', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Get the user's auth_id
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', id)
    .single()

  if (fetchError || !user) {
    return NextResponse.json(
      { success: false, data: null, error: 'User not found', timestamp: new Date().toISOString() },
      { status: 404 }
    )
  }

  // Disable in Supabase Auth
  if (user.auth_id) {
    const { error: authError } = await supabase.auth.admin.updateUserById(user.auth_id, {
      ban_duration: 'none',
      user_metadata: { disabled: true },
    })

    // Use ban to actually prevent login
    const { error: banError } = await supabase.auth.admin.updateUserById(user.auth_id, {
      ban_duration: '876000h', // ~100 years
    })

    if (authError || banError) {
      return NextResponse.json(
        { success: false, data: null, error: (authError || banError)!.message, timestamp: new Date().toISOString() },
        { status: 500 }
      )
    }
  }

  // Mark as inactive in users table
  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json(
      { success: false, data: null, error: updateError.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data: updated,
    error: null,
    timestamp: new Date().toISOString(),
  })
}
