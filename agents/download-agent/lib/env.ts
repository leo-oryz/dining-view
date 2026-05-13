import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Try loading from .env (this dir) and ../../.env.local (parent project) so the
// agent picks up the same secrets the Next.js app already uses.
for (const p of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(p)) loadDotenv({ path: p })
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing env var: ${name}`)
  }
  return v
}

export const ENV = {
  get SUPABASE_URL() { return required('NEXT_PUBLIC_SUPABASE_URL') },
  get SUPABASE_SERVICE_ROLE_KEY() { return required('SUPABASE_SERVICE_ROLE_KEY') },
  IPOS_DAYS: parseInt(process.env.IPOS_DAYS ?? '30', 10),
  IPOS_STORE_ID: process.env.IPOS_STORE_ID || null,
  HEADED: process.env.PLAYWRIGHT_HEADED === '1' || process.env.PWDEBUG === '1',
  DISCOVERY: process.env.IPOS_DISCOVERY === '1',
  IPOS_BASE_URL: process.env.IPOS_BASE_URL || 'https://fabi.ipos.vn',
}
