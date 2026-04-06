import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
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
  const body = await request.json()
  const { role, store_id, display_name } = body

  const validRoles = ['owner', 'manager', 'marketing', 'investor']
  if (role && !validRoles.includes(role)) {
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

  const updateData: Record<string, unknown> = {}
  if (role !== undefined) updateData.role = role
  if (store_id !== undefined) updateData.store_id = store_id || null
  if (display_name !== undefined) updateData.display_name = display_name

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, data: null, error: 'No fields to update', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const { data: updated, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message, timestamp: new Date().toISOString() },
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

export async function DELETE(
  request: NextRequest,
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

  // Cannot delete yourself
  if (id === profile.id) {
    return NextResponse.json(
      { success: false, data: null, error: 'Cannot delete your own account', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Get the user's auth_id before deleting
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('auth_id, email')
    .eq('id', id)
    .single()

  if (fetchError || !user) {
    return NextResponse.json(
      { success: false, data: null, error: 'User not found', timestamp: new Date().toISOString() },
      { status: 404 }
    )
  }

  // Delete from users table
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json(
      { success: false, data: null, error: deleteError.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }

  // Delete from Supabase Auth
  if (user.auth_id) {
    await supabase.auth.admin.deleteUser(user.auth_id)
  }

  return NextResponse.json({
    success: true,
    data: { id, email: user.email },
    error: null,
    timestamp: new Date().toISOString(),
  })
}
