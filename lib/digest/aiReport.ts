import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { prepareAnalysisContext } from '@/lib/ai/dataPrep'
import { getTopProductPairs } from '@/lib/ai/basketAnalysis'
import { getMarginMatrix } from '@/lib/ai/marginMatrix'
import { analyzeWithClaude } from '@/lib/ai/claudeAnalyzer'
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns'
import { createHmac } from 'crypto'

export type ReportType = 'attribution' | 'star_products' | 'retire_candidates'
export type ReportDepth = 'concise' | 'standard' | 'detailed'
export type PeriodType = 'last_week' | 'last_month'

export type ReportScheduleInput = {
  id?: string
  name: string
  period_type: PeriodType
  report_types: ReportType[]
  depth: ReportDepth
  recipient_roles: string[]
  extra_emails: string[]
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  attribution: '營收歸因分析',
  star_products: '明星商品分析',
  retire_candidates: '下架候選分析',
}

interface GeneratedReport {
  type: ReportType
  label: string
  shareUrl: string
  summary: string
}

function generateShareToken(reportId: string): string {
  const secret = process.env.CRON_SECRET || 'fallback-secret'
  return createHmac('sha256', secret).update(reportId).digest('hex').slice(0, 24)
}

function computePeriod(periodType: PeriodType, now: Date): { start: string; end: string; label: string } {
  if (periodType === 'last_month') {
    const firstOfThisMonth = startOfMonth(now)
    const lastDayOfPrev = subDays(firstOfThisMonth, 1)
    const firstOfPrev = startOfMonth(lastDayOfPrev)
    return {
      start: format(firstOfPrev, 'yyyy-MM-dd'),
      end: format(lastDayOfPrev, 'yyyy-MM-dd'),
      label: `${format(firstOfPrev, 'yyyy/MM')} 月報`,
    }
  }
  const lastMonday = startOfWeek(subDays(now, 7), { weekStartsOn: 1 })
  const lastSunday = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1)
  return {
    start: format(lastMonday, 'yyyy-MM-dd'),
    end: format(lastSunday, 'yyyy-MM-dd'),
    label: `${format(lastMonday, 'MM/dd')} – ${format(lastSunday, 'MM/dd')} 週報`,
  }
}

// Depth knobs: how aggressive to truncate the per-report email summary.
// Claude's max_tokens itself is governed by claudeAnalyzer; depth here only
// controls how much we render in the email body.
function summaryCharsForDepth(depth: ReportDepth): number {
  if (depth === 'concise') return 120
  if (depth === 'detailed') return 400
  return 200
}

export async function sendAiReport(
  schedule: ReportScheduleInput
): Promise<{ recipientCount: number; reportsGenerated: number; periodLabel: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@diningview.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diningview.zeabur.app'

  if (!apiKey) {
    return { recipientCount: 0, reportsGenerated: 0, periodLabel: '', error: 'RESEND_API_KEY not configured' }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { recipientCount: 0, reportsGenerated: 0, periodLabel: '', error: 'ANTHROPIC_API_KEY not configured' }
  }

  const supabase = createServiceClient()
  const resend = new Resend(apiKey)

  const today = new Date()
  const period = computePeriod(schedule.period_type, today)

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)

  if (!stores || stores.length === 0) {
    return { recipientCount: 0, reportsGenerated: 0, periodLabel: period.label, error: 'No active stores' }
  }

  // Recipients: union of role-matched users + extra_emails
  const roleEmails: string[] = []
  if (schedule.recipient_roles.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('email')
      .in('role', schedule.recipient_roles)
      .eq('is_active', true)
    if (users) roleEmails.push(...users.map(u => u.email).filter(Boolean))
  }
  const allRecipients = Array.from(new Set([...roleEmails, ...schedule.extra_emails])).filter(e => /@/.test(e))
  if (allRecipients.length === 0) {
    return { recipientCount: 0, reportsGenerated: 0, periodLabel: period.label, error: 'No recipients found' }
  }

  const reportTypes = schedule.report_types
    .filter((t): t is ReportType => t in REPORT_TYPE_LABELS)
    .map(t => ({ type: t, label: REPORT_TYPE_LABELS[t] }))

  if (reportTypes.length === 0) {
    return { recipientCount: 0, reportsGenerated: 0, periodLabel: period.label, error: 'No report types selected' }
  }

  const summaryChars = summaryCharsForDepth(schedule.depth)
  const allReports: { storeName: string; reports: GeneratedReport[] }[] = []

  for (const store of stores) {
    let context, basketResult, marginMatrix
    try {
      ;[context, basketResult, marginMatrix] = await Promise.all([
        prepareAnalysisContext(supabase, store.id, period.start, period.end),
        getTopProductPairs(supabase, store.id, { startDate: period.start, endDate: period.end }),
        getMarginMatrix(supabase, store.id, period.start, period.end),
      ])
    } catch (err) {
      console.error(`[ai-report] Data prep failed for ${store.name}:`, err)
      continue
    }

    const storeReports: GeneratedReport[] = []
    for (const rt of reportTypes) {
      try {
        const reportJson = await analyzeWithClaude(
          rt.type,
          context,
          basketResult.pairs,
          marginMatrix
        )

        const reportDate = format(today, 'yyyy-MM-dd')
        const { data: saved } = await supabase
          .from('ai_analysis_reports')
          .upsert(
            {
              store_id: store.id,
              report_type: rt.type,
              report_date: reportDate,
              period_start: period.start,
              period_end: period.end,
              content: reportJson,
              model_used: 'claude-sonnet-4-6',
            },
            { onConflict: 'store_id,report_type,report_date' }
          )
          .select('id')
          .single()

        if (saved) {
          const token = `${saved.id}-${generateShareToken(saved.id)}`
          const summary = (reportJson as { summary?: string }).summary || ''
          storeReports.push({
            type: rt.type,
            label: rt.label,
            shareUrl: `${appUrl}/shared/${token}`,
            summary: summary.slice(0, summaryChars) + (summary.length > summaryChars ? '...' : ''),
          })
        }
      } catch (err) {
        console.error(`[ai-report] ${rt.type} failed for ${store.name}:`, err)
      }
    }

    if (storeReports.length > 0) {
      allReports.push({ storeName: store.name, reports: storeReports })
    }
  }

  if (allReports.length === 0) {
    return { recipientCount: 0, reportsGenerated: 0, periodLabel: period.label, error: 'All report generations failed' }
  }

  const totalReports = allReports.reduce((s, g) => s + g.reports.length, 0)
  const subject = `DiningView AI ${schedule.period_type === 'last_month' ? '月報' : '週報'} — ${period.start} ~ ${period.end}`

  const storeBlocks = allReports.map((group) => {
    const reportCards = group.reports.map((r) => {
      const colors: Record<string, { bg: string; border: string; icon: string }> = {
        attribution: { bg: '#f5f3ff', border: '#c4b5fd', icon: '📊' },
        star_products: { bg: '#fffbeb', border: '#fcd34d', icon: '⭐' },
        retire_candidates: { bg: '#fef2f2', border: '#fca5a5', icon: '🔍' },
      }
      const c = colors[r.type] || colors.attribution
      return `
        <div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <div style="font-size: 15px; font-weight: bold; margin-bottom: 8px;">${c.icon} ${r.label}</div>
          <p style="font-size: 13px; color: #475569; margin: 0 0 12px 0; line-height: 1.5;">${r.summary}</p>
          <a href="${r.shareUrl}"
             style="display: inline-block; background: #6d28d9; color: white; text-decoration: none; padding: 8px 20px; border-radius: 6px; font-size: 13px;">
            查看完整報告
          </a>
        </div>`
    }).join('')

    return `
      <h3 style="font-size: 16px; margin: 24px 0 8px 0; color: #1e293b;">${group.storeName}</h3>
      ${reportCards}`
  }).join('')

  const periodTitle = schedule.period_type === 'last_month' ? '月報' : '週報'
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="font-size: 22px; margin-bottom: 4px; color: #6d28d9;">🧠 DiningView AI ${periodTitle}</h1>
    <p style="color: #64748b; font-size: 14px; margin-top: 0;">${period.start} ~ ${period.end}</p>
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="font-size: 14px; color: #475569; margin: 0; line-height: 1.6;">
      本期 AI 自動分析已完成，共產生 ${totalReports} 份報告。<br>
      點擊下方連結即可閱讀，<strong>無需登入</strong>。
    </p>
  </div>

  ${storeBlocks}

  <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">
    DiningView — 餐飲智慧平台<br>
    報告由 AI 自動產生，僅供參考<br>
    排程：${schedule.name}
  </p>
</body>
</html>`

  let sendError: string | undefined
  try {
    await resend.emails.send({
      from: fromEmail,
      to: allRecipients,
      subject,
      html,
    })
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'Email send failed'
  }

  return {
    recipientCount: allRecipients.length,
    reportsGenerated: totalReports,
    periodLabel: period.label,
    error: sendError,
  }
}

// Backwards-compat: existing `/api/cron/weekly-ai-report` route still calls
// this. It now wraps sendAiReport with the legacy hard-coded schedule.
export async function sendWeeklyAiReport() {
  return sendAiReport({
    name: '每週週報 (legacy)',
    period_type: 'last_week',
    report_types: ['attribution', 'star_products', 'retire_candidates'],
    depth: 'standard',
    recipient_roles: ['owner', 'marketing'],
    extra_emails: [],
  })
}
