import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { prepareAnalysisContext } from '@/lib/ai/dataPrep'
import { getTopProductPairs } from '@/lib/ai/basketAnalysis'
import { getMarginMatrix } from '@/lib/ai/marginMatrix'
import { analyzeWithClaude } from '@/lib/ai/claudeAnalyzer'
import { format, subDays, startOfWeek } from 'date-fns'
import { createHmac } from 'crypto'

type ReportType = 'attribution' | 'star_products' | 'retire_candidates'

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

export async function sendWeeklyAiReport(): Promise<{
  recipientCount: number
  reportsGenerated: number
  error?: string
}> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fnbpulse.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fnb-pluse.zeabur.app'

  if (!apiKey) {
    return { recipientCount: 0, reportsGenerated: 0, error: 'RESEND_API_KEY not configured' }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { recipientCount: 0, reportsGenerated: 0, error: 'ANTHROPIC_API_KEY not configured' }
  }

  const supabase = createServiceClient()
  const resend = new Resend(apiKey)

  // Last week: Monday to Sunday
  const today = new Date()
  const lastMonday = startOfWeek(subDays(today, 7), { weekStartsOn: 1 })
  const lastSunday = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1)
  const weekStart = format(lastMonday, 'yyyy-MM-dd')
  const weekEnd = format(lastSunday, 'yyyy-MM-dd')

  // Get all active stores
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)

  if (!stores || stores.length === 0) {
    return { recipientCount: 0, reportsGenerated: 0, error: 'No active stores' }
  }

  // Get recipients: owners and marketing users
  const { data: users } = await supabase
    .from('users')
    .select('email, name')
    .in('role', ['owner', 'marketing'])
    .eq('is_active', true)

  if (!users || users.length === 0) {
    return { recipientCount: 0, reportsGenerated: 0, error: 'No recipients found' }
  }

  const reportTypes: { type: ReportType; label: string }[] = [
    { type: 'attribution', label: '營收歸因分析' },
    { type: 'star_products', label: '明星商品分析' },
    { type: 'retire_candidates', label: '下架候選分析' },
  ]

  const allReports: { storeName: string; reports: GeneratedReport[] }[] = []

  for (const store of stores) {
    const storeReports: GeneratedReport[] = []

    // Gather data once per store
    let context, basketResult, marginMatrix
    try {
      ;[context, basketResult, marginMatrix] = await Promise.all([
        prepareAnalysisContext(supabase, store.id, weekStart, weekEnd),
        getTopProductPairs(supabase, store.id, { startDate: weekStart, endDate: weekEnd }),
        getMarginMatrix(supabase, store.id, weekStart, weekEnd),
      ])
    } catch (err) {
      console.error(`[weekly-ai-report] Data prep failed for ${store.name}:`, err)
      continue
    }

    // Generate each report type
    for (const rt of reportTypes) {
      try {
        const reportJson = await analyzeWithClaude(
          rt.type,
          context,
          basketResult.pairs,
          marginMatrix
        )

        // Save to DB
        const reportDate = format(today, 'yyyy-MM-dd')
        const { data: saved } = await supabase
          .from('ai_analysis_reports')
          .upsert(
            {
              store_id: store.id,
              report_type: rt.type,
              report_date: reportDate,
              period_start: weekStart,
              period_end: weekEnd,
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
            summary: summary.slice(0, 200) + (summary.length > 200 ? '...' : ''),
          })
        }
      } catch (err) {
        console.error(`[weekly-ai-report] ${rt.type} failed for ${store.name}:`, err)
      }
    }

    if (storeReports.length > 0) {
      allReports.push({ storeName: store.name, reports: storeReports })
    }
  }

  if (allReports.length === 0) {
    return { recipientCount: 0, reportsGenerated: 0, error: 'All report generations failed' }
  }

  const totalReports = allReports.reduce((s, g) => s + g.reports.length, 0)

  // Build email
  const subject = `FnB Pulse AI 週報 — ${weekStart} ~ ${weekEnd}`

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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="font-size: 22px; margin-bottom: 4px; color: #6d28d9;">🧠 FnB Pulse AI 週報</h1>
    <p style="color: #64748b; font-size: 14px; margin-top: 0;">${weekStart} ~ ${weekEnd}</p>
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="font-size: 14px; color: #475569; margin: 0; line-height: 1.6;">
      本週 AI 自動分析已完成，共產生 ${totalReports} 份報告。<br>
      點擊下方連結即可閱讀，<strong>無需登入</strong>。
    </p>
  </div>

  ${storeBlocks}

  <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">
    FnB Pulse — 餐飲智慧平台<br>
    報告由 AI 自動產生，僅供參考
  </p>
</body>
</html>`

  let sendError: string | undefined

  try {
    await resend.emails.send({
      from: fromEmail,
      to: users.map((u) => u.email),
      subject,
      html,
    })
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'Email send failed'
  }

  return {
    recipientCount: users.length,
    reportsGenerated: totalReports,
    error: sendError,
  }
}
