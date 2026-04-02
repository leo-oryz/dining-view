/**
 * One-time setup script: Create owner + manager auth users and link them in the users table.
 * Run with: node scripts/setup-users.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Run from project root: node scripts/setup-users.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const OWNER_EMAIL = 'owner@fnbpulse.com'
const OWNER_PASSWORD = 'FnbPulse2026!'
const MANAGER_EMAIL = 'manager@fnbpulse.com'
const MANAGER_PASSWORD = 'FnbPulse2026!'
const STORE_ID = '00000000-0000-0000-0000-000000000001'

async function createAuthUser(email, password) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification
  })
  if (error) {
    if (error.message.includes('already been registered')) {
      console.log(`  ⏭  ${email} already exists, fetching...`)
      const { data: list } = await supabase.auth.admin.listUsers()
      const user = list.users.find(u => u.email === email)
      return user
    }
    throw error
  }
  return data.user
}

async function main() {
  console.log('=== FnB Pulse: Setting up users ===\n')

  // 1. Create Owner auth user
  console.log('1. Creating owner auth user...')
  const owner = await createAuthUser(OWNER_EMAIL, OWNER_PASSWORD)
  console.log(`   ✅ Owner auth_id: ${owner.id}`)

  // 2. Create Manager auth user
  console.log('2. Creating manager auth user...')
  const manager = await createAuthUser(MANAGER_EMAIL, MANAGER_PASSWORD)
  console.log(`   ✅ Manager auth_id: ${manager.id}`)

  // 3. Insert into users table
  console.log('3. Inserting into users table...')

  const { error: ownerErr } = await supabase
    .from('users')
    .upsert({
      auth_id: owner.id,
      email: OWNER_EMAIL,
      name: 'Owner',
      role: 'owner',
      store_id: null,
    }, { onConflict: 'email' })

  if (ownerErr) {
    console.error('   ❌ Owner insert failed:', ownerErr.message)
  } else {
    console.log('   ✅ Owner → role=owner, store_id=NULL (sees all stores)')
  }

  const { error: managerErr } = await supabase
    .from('users')
    .upsert({
      auth_id: manager.id,
      email: MANAGER_EMAIL,
      name: 'Manager',
      role: 'manager',
      store_id: STORE_ID,
    }, { onConflict: 'email' })

  if (managerErr) {
    console.error('   ❌ Manager insert failed:', managerErr.message)
  } else {
    console.log(`   ✅ Manager → role=manager, store_id=${STORE_ID} (BE& 西門)`)
  }

  console.log('\n=== Done! ===')
  console.log(`\nLogin credentials:`)
  console.log(`  Owner:   ${OWNER_EMAIL} / ${OWNER_PASSWORD}`)
  console.log(`  Manager: ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
