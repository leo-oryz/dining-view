import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  const k = t.slice(0, i)
  let v = t.slice(i + 1)
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!process.env[k]) process.env[k] = v
}

const [, , email, password] = process.argv
if (!email || !password) {
  console.error('Usage: npx tsx scripts/set_user_password.ts <email> <password>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function main() {
  // Find auth user by email (paginate until found)
  let authUser: { id: string; email?: string } | null = null
  let page = 1
  while (!authUser) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    authUser = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase()) ?? null
    if (authUser) break
    if (data.users.length < 200) break
    page++
  }

  if (!authUser) {
    console.error(`No auth user found for ${email}`)
    process.exit(1)
  }

  // Update password + confirm email (in case invite never completed)
  const { error: updErr } = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
  })
  if (updErr) throw updErr

  // Sanity check: show the public.users row
  const { data: row } = await supabase
    .from('users')
    .select('id, email, role, store_id, is_active, display_name')
    .eq('auth_id', authUser.id)
    .maybeSingle()

  console.log(`✅ Password updated for ${email}`)
  console.log(`   auth_id: ${authUser.id}`)
  if (row) {
    console.log(`   users row: role=${row.role}, store_id=${row.store_id ?? 'null'}, active=${row.is_active}`)
  } else {
    console.log('   ⚠️  No matching row in public.users — user may not be able to log in until linked')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
