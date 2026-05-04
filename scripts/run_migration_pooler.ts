import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Client } from 'pg'

const envPath = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i === -1) continue
  const k = t.slice(0, i); let v = t.slice(i + 1)
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!process.env[k]) process.env[k] = v
}

const file = process.argv[2]
if (!file) { console.error('usage: run_migration_pooler.ts <path-to-sql>'); process.exit(1) }

;(async () => {
  const sql = readFileSync(file, 'utf-8')
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL!,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  console.log(`Running ${file} via pooler ...`)
  try {
    await client.query(sql)
    console.log('✓ applied')
  } catch (e: unknown) {
    console.error('✗', e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  }
  await client.end()
})()
