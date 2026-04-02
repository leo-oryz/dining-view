import { createServerSupabase } from '@/lib/supabase/server'

export type UserProfile = {
  id: string
  auth_id: string
  email: string
  name: string | null
  role: 'owner' | 'manager' | 'marketing' | 'investor'
  store_id: string | null
}

export async function getSession() {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, auth_id, email, name, role, store_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) return null

  return profile as UserProfile
}
