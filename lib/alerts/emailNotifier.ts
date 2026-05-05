import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { APP_TIMEZONE } from '@/lib/constants/timezone'

interface AlertItem {
  severity: string
  message: string
  alert_type: string
}

export async function sendAlertEmail(
  anomalies: AlertItem[],
  storeIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@diningview.app'

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const supabase = createServiceClient()
  const resend = new Resend(apiKey)

  // Get alert email recipients from alert_settings
  let query = supabase
    .from('alert_settings')
    .select('alert_emails')
    .eq('is_enabled', true)

  if (storeIds && storeIds.length > 0) {
    query = query.in('store_id', storeIds)
  }

  const { data: settings } = await query

  if (!settings || settings.length === 0) {
    return { success: false, error: 'No alert email recipients configured' }
  }

  // Collect unique emails
  const emails = Array.from(new Set(settings.flatMap(s => s.alert_emails))).filter(Boolean)

  if (emails.length === 0) {
    return { success: false, error: 'No alert email recipients configured' }
  }

  const today = new Date().toLocaleDateString('vi-VN', { timeZone: APP_TIMEZONE })

  const alertRows = anomalies.map(a => {
    const icon = a.severity === 'critical' ? '🔴' : '🟡'
    const severityLabel = a.severity === 'critical' ? '嚴重' : '警告'
    return `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 8px; font-size: 14px;">${icon} ${severityLabel}</td>
      <td style="padding: 12px 8px; font-size: 14px;">${a.message}</td>
    </tr>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <h1 style="font-size: 20px; margin-bottom: 4px;">DiningView 異常警報</h1>
  <p style="color: #64748b; font-size: 14px; margin-top: 0;">${today}</p>

  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="font-size: 14px; color: #dc2626; font-weight: bold;">偵測到 ${anomalies.length} 項異常</div>
  </div>

  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="border-bottom: 2px solid #e2e8f0;">
        <th style="text-align: left; padding: 8px; font-size: 12px; color: #64748b;">嚴重程度</th>
        <th style="text-align: left; padding: 8px; font-size: 12px; color: #64748b;">說明</th>
      </tr>
    </thead>
    <tbody>
      ${alertRows}
    </tbody>
  </table>

  <div style="margin-top: 24px; text-align: center;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://diningview.com'}/alerts"
       style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px;">
      查看完整警報
    </a>
  </div>

  <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
    DiningView — 餐飲智慧平台
  </p>
</body>
</html>`

  try {
    await resend.emails.send({
      from: fromEmail,
      to: emails,
      subject: `[DiningView 警報] 偵測到 ${anomalies.length} 項異常 — ${today}`,
      html,
    })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed'
    return { success: false, error: msg }
  }
}
