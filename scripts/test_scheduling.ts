import { computeNextRunAt } from '../lib/digest/scheduling'

const cases: Array<{ label: string; expected: string; got: Date }> = []

const fri = new Date('2026-05-08T08:00:00Z') // Fri 16:00 Taipei
cases.push({
  label: 'Weekly Tue 09:00 Taipei from Fri 16:00 Taipei',
  expected: '2026-05-12T01:00:00.000Z',
  got: computeNextRunAt({
    frequency: 'weekly', day_of_week: 2, day_of_month: null,
    send_hour: 9, send_minute: 0, timezone: 'Asia/Ho_Chi_Minh',
  }, fri),
})

const tueMorn = new Date('2026-05-12T00:00:00Z') // Tue 08:00 Taipei
cases.push({
  label: 'Weekly Tue 09:00 from Tue 08:00 Taipei (before fire)',
  expected: '2026-05-12T01:00:00.000Z',
  got: computeNextRunAt({
    frequency: 'weekly', day_of_week: 2, day_of_month: null,
    send_hour: 9, send_minute: 0, timezone: 'Asia/Ho_Chi_Minh',
  }, tueMorn),
})

const tueAfter = new Date('2026-05-12T01:30:00Z') // Tue 09:30 Taipei
cases.push({
  label: 'Weekly Tue 09:00 from Tue 09:30 Taipei (after fire)',
  expected: '2026-05-19T01:00:00.000Z',
  got: computeNextRunAt({
    frequency: 'weekly', day_of_week: 2, day_of_month: null,
    send_hour: 9, send_minute: 0, timezone: 'Asia/Ho_Chi_Minh',
  }, tueAfter),
})

const may1 = new Date('2026-05-01T03:00:00Z') // May 1 11:00 Taipei
cases.push({
  label: 'Monthly 3rd 09:00 Taipei from May 1',
  expected: '2026-05-03T01:00:00.000Z',
  got: computeNextRunAt({
    frequency: 'monthly', day_of_week: null, day_of_month: 3,
    send_hour: 9, send_minute: 0, timezone: 'Asia/Ho_Chi_Minh',
  }, may1),
})

const may4 = new Date('2026-05-04T03:00:00Z') // May 4 11:00 Taipei
cases.push({
  label: 'Monthly 3rd 09:00 from May 4 (after passed)',
  expected: '2026-06-03T01:00:00.000Z',
  got: computeNextRunAt({
    frequency: 'monthly', day_of_week: null, day_of_month: 3,
    send_hour: 9, send_minute: 0, timezone: 'Asia/Ho_Chi_Minh',
  }, may4),
})

let failed = 0
for (const c of cases) {
  const got = c.got.toISOString()
  const ok = got === c.expected
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${c.label}\n  expected ${c.expected}\n  got      ${got}`)
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`)
  process.exit(1)
}
console.log('\nAll passed.')
