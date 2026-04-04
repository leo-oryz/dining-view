import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { format, subDays, startOfWeek } from 'date-fns'
import { type WeatherDaily, getWeatherType, isTyphoon, isRainy } from '@/lib/weather/weatherUtils'

interface DigestData {
  weekStart: string
  weekEnd: string
  totalRevenue: number
  prevWeekRevenue: number
  revenueDelta: number | null
  newMembers: number
  topProducts: { name: string; revenue: number }[]
  alertCount: number
  reviewNewCount: number
  reviewAvgRating: number | null
  reviewPrevAvgRating: number | null
  hasRatingDrop: boolean
  weatherSummary: { sunny: number; rainy: number; typhoon: number; other: number }
}

export async function compileDigest(): Promise<DigestData> {
  const supabase = createServiceClient()

  // Last week: Monday to Sunday
  const today = new Date()
  const lastMonday = startOfWeek(subDays(today, 7), { weekStartsOn: 1 })
  const lastSunday = subDays(startOfWeek(today, { weekStartsOn: 1 }), 1)
  const prevMonday = subDays(lastMonday, 7)
  const prevSunday = subDays(lastMonday, 1)

  const weekStart = format(lastMonday, 'yyyy-MM-dd')
  const weekEnd = format(lastSunday, 'yyyy-MM-dd')
  const prevStart = format(prevMonday, 'yyyy-MM-dd')
  const prevEnd = format(prevSunday, 'yyyy-MM-dd')

  // Fetch all stores' sales for last week and previous week
  const [lastWeekRes, prevWeekRes, productsRes, membersRes, alertsRes, reviewSnapRes, prevReviewSnapRes, weatherRes] = await Promise.all([
    supabase
      .from('daily_sales')
      .select('net_sales')
      .gte('date', weekStart)
      .lte('date', weekEnd),
    supabase
      .from('daily_sales')
      .select('net_sales')
      .gte('date', prevStart)
      .lte('date', prevEnd),
    supabase
      .from('product_sales')
      .select('product_name, revenue')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('revenue', { ascending: false })
      .limit(200),
    supabase
      .from('daily_sales')
      .select('new_members')
      .gte('date', weekStart)
      .lte('date', weekEnd),
    supabase
      .from('anomaly_alerts')
      .select('id')
      .gte('created_at', `${weekStart}T00:00:00`)
      .lte('created_at', `${weekEnd}T23:59:59`),
    supabase
      .from('google_review_snapshots')
      .select('avg_rating, new_reviews_count')
      .gte('snapshot_date', weekStart)
      .lte('snapshot_date', weekEnd)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('google_review_snapshots')
      .select('avg_rating')
      .gte('snapshot_date', prevStart)
      .lte('snapshot_date', prevEnd)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('weather_daily')
      .select('date, description, precipitation')
      .gte('date', weekStart)
      .lte('date', weekEnd),
  ])

  const totalRevenue = (lastWeekRes.data || []).reduce((sum, r) => sum + (Number(r.net_sales) || 0), 0)
  const prevWeekRevenue = (prevWeekRes.data || []).reduce((sum, r) => sum + (Number(r.net_sales) || 0), 0)
  const revenueDelta = prevWeekRevenue > 0
    ? ((totalRevenue - prevWeekRevenue) / prevWeekRevenue) * 100
    : null

  // Aggregate top products
  const productMap = new Map<string, number>()
  for (const p of productsRes.data || []) {
    productMap.set(p.product_name, (productMap.get(p.product_name) || 0) + (Number(p.revenue) || 0))
  }
  const topProducts = Array.from(productMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, revenue]) => ({ name, revenue }))

  const newMembers = (membersRes.data || []).reduce((sum, r) => sum + (Number(r.new_members) || 0), 0)
  const alertCount = alertsRes.data?.length || 0

  const reviewNewCount = reviewSnapRes.data?.new_reviews_count || 0
  const reviewAvgRating = reviewSnapRes.data?.avg_rating ? Number(reviewSnapRes.data.avg_rating) : null
  const reviewPrevAvgRating = prevReviewSnapRes.data?.avg_rating ? Number(prevReviewSnapRes.data.avg_rating) : null
  const hasRatingDrop = reviewAvgRating != null && reviewPrevAvgRating != null && reviewAvgRating < reviewPrevAvgRating - 0.3

  // Weather summary
  const weatherSummary = { sunny: 0, rainy: 0, typhoon: 0, other: 0 }
  for (const w of weatherRes.data || []) {
    const wd = w as WeatherDaily
    if (isTyphoon(wd)) weatherSummary.typhoon++
    else if (isRainy(wd)) weatherSummary.rainy++
    else {
      const type = getWeatherType(wd)
      if (type === 'sunny' || type === 'cloudy') weatherSummary.sunny++
      else weatherSummary.other++
    }
  }

  return {
    weekStart,
    weekEnd,
    totalRevenue,
    prevWeekRevenue,
    revenueDelta,
    newMembers,
    topProducts,
    alertCount,
    reviewNewCount,
    reviewAvgRating,
    reviewPrevAvgRating,
    hasRatingDrop,
    weatherSummary,
  }
}

export async function sendDigest(): Promise<{ recipientCount: number; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fnbpulse.com'

  if (!apiKey) {
    return { recipientCount: 0, error: 'RESEND_API_KEY not configured' }
  }

  const supabase = createServiceClient()
  const resend = new Resend(apiKey)

  // Get recipients: owners and marketing users
  const { data: users } = await supabase
    .from('users')
    .select('email, name')
    .in('role', ['owner', 'marketing'])
    .eq('is_active', true)

  if (!users || users.length === 0) {
    return { recipientCount: 0, error: 'No recipients found' }
  }

  const digest = await compileDigest()
  const subject = `FnB Pulse 週報 — ${digest.weekStart} ~ ${digest.weekEnd}`

  const deltaStr = digest.revenueDelta != null
    ? `${digest.revenueDelta > 0 ? '+' : ''}${digest.revenueDelta.toFixed(1)}%`
    : 'N/A'
  const deltaColor = digest.revenueDelta != null && digest.revenueDelta >= 0 ? '#16a34a' : '#dc2626'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <h1 style="font-size: 20px; margin-bottom: 4px;">FnB Pulse 週報</h1>
  <p style="color: #64748b; font-size: 14px; margin-top: 0;">${digest.weekStart} ~ ${digest.weekEnd}</p>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="font-size: 14px; color: #64748b;">上週總營收</div>
    <div style="font-size: 28px; font-weight: bold; margin: 4px 0;">NT$${digest.totalRevenue.toLocaleString()}</div>
    <div style="font-size: 14px; color: ${deltaColor};">vs 前一週: ${deltaStr}</div>
  </div>

  <div style="display: flex; gap: 12px; margin: 16px 0;">
    <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px;">
      <div style="font-size: 12px; color: #16a34a;">新會員</div>
      <div style="font-size: 20px; font-weight: bold;">${digest.newMembers}</div>
    </div>
    <div style="flex: 1; background: ${digest.alertCount > 0 ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${digest.alertCount > 0 ? '#fecaca' : '#e2e8f0'}; border-radius: 8px; padding: 12px;">
      <div style="font-size: 12px; color: ${digest.alertCount > 0 ? '#dc2626' : '#64748b'};">異常警報</div>
      <div style="font-size: 20px; font-weight: bold;">${digest.alertCount}</div>
    </div>
  </div>

  ${digest.reviewAvgRating != null ? `
  <div style="background: ${digest.hasRatingDrop ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${digest.hasRatingDrop ? '#fecaca' : '#e2e8f0'}; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="font-size: 14px; color: #64748b;">Google 評論</div>
    <div style="font-size: 20px; font-weight: bold; margin: 4px 0;">
      ${digest.reviewAvgRating.toFixed(2)} ★ <span style="font-size: 14px; font-weight: normal; color: #64748b;">(${digest.reviewNewCount} 則新評論)</span>
    </div>
    ${digest.reviewPrevAvgRating != null ? `<div style="font-size: 14px; color: ${digest.reviewAvgRating >= digest.reviewPrevAvgRating ? '#16a34a' : '#dc2626'};">vs 上週: ${digest.reviewPrevAvgRating.toFixed(2)}</div>` : ''}
    ${digest.hasRatingDrop ? '<div style="font-size: 14px; font-weight: bold; color: #dc2626; margin-top: 4px;">⚠️ 評分顯著下滑，請注意顧客反饋</div>' : ''}
  </div>` : ''}

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="font-size: 14px; color: #64748b;">本週天氣</div>
    <div style="font-size: 14px; margin-top: 4px;">
      晴天/多雲 ${digest.weatherSummary.sunny} 天、雨天 ${digest.weatherSummary.rainy} 天、颱風 ${digest.weatherSummary.typhoon} 天
    </div>
    ${digest.weatherSummary.typhoon > 0 ? '<div style="font-size: 14px; font-weight: bold; color: #dc2626; margin-top: 4px;">⚠️ 本週有 ' + digest.weatherSummary.typhoon + ' 天颱風影響，業績受天氣因素拖累</div>' : ''}
  </div>

  <h3 style="font-size: 16px; margin-top: 20px;">Top 3 商品</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    ${digest.topProducts.map((p, i) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 4px; color: #64748b;">${i + 1}</td>
      <td style="padding: 8px 4px;">${p.name}</td>
      <td style="padding: 8px 4px; text-align: right;">NT$${p.revenue.toLocaleString()}</td>
    </tr>`).join('')}
  </table>

  <div style="margin-top: 24px; text-align: center;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://fnbpulse.com'}/dashboard"
       style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px;">
      查看完整儀表板
    </a>
  </div>

  <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
    FnB Pulse — 餐飲智慧平台
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

  // Record in weekly_digests
  const status = sendError ? 'failed' : 'success'
  await supabase.from('weekly_digests').insert({
    week_start: digest.weekStart,
    recipient_count: users.length,
    status,
    error_message: sendError || null,
  })

  return { recipientCount: users.length, error: sendError }
}
