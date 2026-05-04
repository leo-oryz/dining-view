const VALID_REPORT_TYPES = ['attribution', 'star_products', 'retire_candidates'] as const
const VALID_ROLES = ['owner', 'manager', 'marketing', 'investor'] as const
const VALID_DEPTHS = ['concise', 'standard', 'detailed'] as const
const VALID_PERIODS = ['last_week', 'last_month'] as const
const VALID_FREQS = ['weekly', 'monthly'] as const

export type ValidatedSchedule = {
  name: string
  is_active: boolean
  frequency: 'weekly' | 'monthly'
  day_of_week: number | null
  day_of_month: number | null
  send_hour: number
  send_minute: number
  timezone: string
  period_type: 'last_week' | 'last_month'
  report_types: string[]
  depth: 'concise' | 'standard' | 'detailed'
  recipient_roles: string[]
  extra_emails: string[]
}

export function validateAndCoerce(body: Record<string, unknown>): { schedule: ValidatedSchedule } | { error: string } {
  const name = String(body.name || '').trim()
  if (!name) return { error: 'name is required' }
  if (name.length > 80) return { error: 'name too long' }

  const frequency = body.frequency as string
  if (!VALID_FREQS.includes(frequency as typeof VALID_FREQS[number])) {
    return { error: 'frequency must be weekly or monthly' }
  }

  let day_of_week: number | null = null
  let day_of_month: number | null = null
  if (frequency === 'weekly') {
    const d = Number(body.day_of_week)
    if (!Number.isInteger(d) || d < 1 || d > 7) return { error: 'day_of_week must be 1-7' }
    day_of_week = d
  } else {
    const d = Number(body.day_of_month)
    if (!Number.isInteger(d) || d < 1 || d > 28) return { error: 'day_of_month must be 1-28' }
    day_of_month = d
  }

  const send_hour = Number(body.send_hour)
  if (!Number.isInteger(send_hour) || send_hour < 0 || send_hour > 23) return { error: 'send_hour must be 0-23' }
  const send_minute = Number(body.send_minute ?? 0)
  if (!Number.isInteger(send_minute) || send_minute < 0 || send_minute > 59) return { error: 'send_minute must be 0-59' }

  const timezone = String(body.timezone || 'Asia/Taipei')

  const period_type = body.period_type as string
  if (!VALID_PERIODS.includes(period_type as typeof VALID_PERIODS[number])) {
    return { error: 'period_type must be last_week or last_month' }
  }

  const report_types = Array.isArray(body.report_types) ? body.report_types : []
  const cleanedTypes = report_types
    .map(String)
    .filter(t => VALID_REPORT_TYPES.includes(t as typeof VALID_REPORT_TYPES[number]))
  if (cleanedTypes.length === 0) return { error: 'at least one report_type required' }

  const depth = String(body.depth || 'standard')
  if (!VALID_DEPTHS.includes(depth as typeof VALID_DEPTHS[number])) return { error: 'invalid depth' }

  const recipient_roles = Array.isArray(body.recipient_roles) ? body.recipient_roles : []
  const cleanedRoles = recipient_roles
    .map(String)
    .filter(r => VALID_ROLES.includes(r as typeof VALID_ROLES[number]))

  const extra_emails = Array.isArray(body.extra_emails) ? body.extra_emails : []
  const cleanedEmails = extra_emails
    .map(String)
    .map(e => e.trim())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

  if (cleanedRoles.length === 0 && cleanedEmails.length === 0) {
    return { error: 'at least one recipient (role or email) required' }
  }

  return {
    schedule: {
      name,
      is_active: body.is_active !== false,
      frequency: frequency as 'weekly' | 'monthly',
      day_of_week,
      day_of_month,
      send_hour,
      send_minute,
      timezone,
      period_type: period_type as 'last_week' | 'last_month',
      report_types: cleanedTypes,
      depth: depth as 'concise' | 'standard' | 'detailed',
      recipient_roles: cleanedRoles,
      extra_emails: cleanedEmails,
    },
  }
}
