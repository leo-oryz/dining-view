import { createServiceClient } from '@/lib/supabase/server'
import { sendAlertEmail } from './emailNotifier'
import { detectProductAnomalies } from '@/lib/products/anomalyDetector'

type AlertType = 'revenue_drop' | 'cost_spike' | 'member_churn' | 'delivery_drop' | 'rating_drop' | 'product_anomaly'

interface DetectedAnomaly {
  store_id: string
  store_name: string
  alert_type: AlertType
  severity: 'info' | 'warning' | 'critical'
  metric_value: number
  threshold_value: number
  message: string
}

/**
 * Run anomaly detection across all active stores.
 * Checks 4 conditions against 7-day rolling averages.
 */
export async function detectAnomalies(): Promise<DetectedAnomaly[]> {
  const supabase = createServiceClient()

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)

  if (!stores || stores.length === 0) return []

  const today = new Date()
  today.setDate(today.getDate() - 1) // check yesterday (data delay)
  const yesterday = today.toISOString().split('T')[0]

  // 7-day window ending day before yesterday
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() - 1)
  const windowStart = new Date(windowEnd)
  windowStart.setDate(windowStart.getDate() - 6)
  const windowStartStr = windowStart.toISOString().split('T')[0]
  const windowEndStr = windowEnd.toISOString().split('T')[0]

  const anomalies: DetectedAnomaly[] = []

  for (const store of stores) {
    // Fetch yesterday's daily_sales
    const { data: todayRow } = await supabase
      .from('daily_sales')
      .select('net_sales, guests, member_visits, new_members')
      .eq('store_id', store.id)
      .eq('date', yesterday)
      .single()

    // Fetch 7-day average
    const { data: weekRows } = await supabase
      .from('daily_sales')
      .select('net_sales, guests, member_visits, new_members')
      .eq('store_id', store.id)
      .gte('date', windowStartStr)
      .lte('date', windowEndStr)

    if (!todayRow || !weekRows || weekRows.length < 3) continue

    const avg = (field: string) => {
      const vals = weekRows
        .map(r => Number((r as Record<string, unknown>)[field]) || 0)
        .filter(v => v > 0)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }

    // 1. Revenue drop: yesterday < 80% of 7-day average
    const revAvg = avg('net_sales')
    const revYesterday = Number(todayRow.net_sales) || 0
    if (revAvg > 0 && revYesterday < revAvg * 0.8) {
      const pct = ((revAvg - revYesterday) / revAvg * 100).toFixed(1)
      anomalies.push({
        store_id: store.id,
        store_name: store.name,
        alert_type: 'revenue_drop',
        severity: revYesterday < revAvg * 0.6 ? 'critical' : 'warning',
        metric_value: revYesterday,
        threshold_value: revAvg * 0.8,
        message: `${store.name}：營收下降 ${pct}%（昨日 NT$${revYesterday.toLocaleString()} vs 7日均值 NT$${Math.round(revAvg).toLocaleString()}）`,
      })
    }

    // 2. Member churn: member visits drop > 30%
    const memberAvg = avg('member_visits')
    const memberYesterday = Number(todayRow.member_visits) || 0
    if (memberAvg > 0 && memberYesterday < memberAvg * 0.7) {
      const pct = ((memberAvg - memberYesterday) / memberAvg * 100).toFixed(1)
      anomalies.push({
        store_id: store.id,
        store_name: store.name,
        alert_type: 'member_churn',
        severity: 'warning',
        metric_value: memberYesterday,
        threshold_value: memberAvg * 0.7,
        message: `${store.name}：會員來客下降 ${pct}%（昨日 ${memberYesterday} vs 7日均值 ${Math.round(memberAvg)}）`,
      })
    }

    // 3. Delivery drop: delivery revenue drop > 40%
    const { data: deliveryYesterday } = await supabase
      .from('delivery_sales')
      .select('revenue')
      .eq('store_id', store.id)
      .eq('date', yesterday)

    const { data: deliveryWeek } = await supabase
      .from('delivery_sales')
      .select('revenue')
      .eq('store_id', store.id)
      .gte('date', windowStartStr)
      .lte('date', windowEndStr)

    const delivRevYesterday = (deliveryYesterday || []).reduce((s, r) => s + (Number(r.revenue) || 0), 0)
    const delivRevWeek = (deliveryWeek || [])
    if (delivRevWeek.length > 0) {
      const totalDelivRev = delivRevWeek.reduce((s, r) => s + (Number(r.revenue) || 0), 0)
      const delivAvg = totalDelivRev / 7
      if (delivAvg > 0 && delivRevYesterday < delivAvg * 0.6) {
        const pct = ((delivAvg - delivRevYesterday) / delivAvg * 100).toFixed(1)
        anomalies.push({
          store_id: store.id,
          store_name: store.name,
          alert_type: 'delivery_drop',
          severity: 'warning',
          metric_value: delivRevYesterday,
          threshold_value: delivAvg * 0.6,
          message: `${store.name}：外送營收下降 ${pct}%（昨日 NT$${delivRevYesterday.toLocaleString()} vs 7日均值 NT$${Math.round(delivAvg).toLocaleString()}）`,
        })
      }
    }

    // 4. Cost spike: avg gross margin drop (from product_sales)
    const { data: costYesterday } = await supabase
      .from('product_sales')
      .select('gross_margin')
      .eq('store_id', store.id)
      .eq('date', yesterday)
      .not('gross_margin', 'is', null)

    const { data: costWeek } = await supabase
      .from('product_sales')
      .select('gross_margin')
      .eq('store_id', store.id)
      .gte('date', windowStartStr)
      .lte('date', windowEndStr)
      .not('gross_margin', 'is', null)

    if (costYesterday && costYesterday.length > 0 && costWeek && costWeek.length > 0) {
      const avgMarginYesterday = costYesterday.reduce((s, r) => s + (Number(r.gross_margin) || 0), 0) / costYesterday.length
      const avgMarginWeek = costWeek.reduce((s, r) => s + (Number(r.gross_margin) || 0), 0) / costWeek.length
      // Cost spike = margin dropped by >20% (relative)
      if (avgMarginWeek > 0 && avgMarginYesterday < avgMarginWeek * 0.8) {
        const pct = ((avgMarginWeek - avgMarginYesterday) / avgMarginWeek * 100).toFixed(1)
        anomalies.push({
          store_id: store.id,
          store_name: store.name,
          alert_type: 'cost_spike',
          severity: 'warning',
          metric_value: avgMarginYesterday,
          threshold_value: avgMarginWeek * 0.8,
          message: `${store.name}：毛利率下降 ${pct}%（昨日 ${(avgMarginYesterday * 100).toFixed(1)}% vs 7日均值 ${(avgMarginWeek * 100).toFixed(1)}%）`,
        })
      }
    }

    // 5. Rating drop: weekly avg_rating < 4-week average - 0.3
    const { data: recentSnapshots } = await supabase
      .from('google_review_snapshots')
      .select('snapshot_date, avg_rating')
      .eq('store_id', store.id)
      .not('avg_rating', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(5)

    if (recentSnapshots && recentSnapshots.length >= 3) {
      const [latestSnap, ...olderSnaps] = recentSnapshots
      // Need at least 3 older snapshots for 4-week baseline (excluding current)
      const baselineSnaps = olderSnaps.slice(0, 4)
      if (baselineSnaps.length >= 3 && latestSnap.avg_rating != null) {
        const baselineAvg = baselineSnaps.reduce((s, r) => s + Number(r.avg_rating), 0) / baselineSnaps.length
        const currentRating = Number(latestSnap.avg_rating)
        if (currentRating < baselineAvg - 0.3) {
          const drop = (baselineAvg - currentRating).toFixed(2)
          anomalies.push({
            store_id: store.id,
            store_name: store.name,
            alert_type: 'rating_drop',
            severity: currentRating < baselineAvg - 0.5 ? 'critical' : 'warning',
            metric_value: currentRating,
            threshold_value: baselineAvg - 0.3,
            message: `${store.name}：Google 評分下降 ${drop}（本週 ${currentRating.toFixed(2)} vs 前 4 週均值 ${baselineAvg.toFixed(2)}）`,
          })
        }
      }
    }

    // 6. Product anomaly: 3+ products dropping on same day (exclude typhoon days)
    const productAnomalies = await detectProductAnomalies(supabase, store.id, yesterday, yesterday, 'drop')
    const nonTyphoonDrops = productAnomalies.filter(a => !a.is_typhoon_day)
    if (nonTyphoonDrops.length >= 3) {
      const productNames = nonTyphoonDrops.slice(0, 5).map(a => a.product_name).join('、')
      anomalies.push({
        store_id: store.id,
        store_name: store.name,
        alert_type: 'product_anomaly',
        severity: nonTyphoonDrops.length >= 5 ? 'critical' : 'warning',
        metric_value: nonTyphoonDrops.length,
        threshold_value: 3,
        message: `${store.name}：${nonTyphoonDrops.length} 個商品同時銷量下降（${productNames}）`,
      })
    }
  }

  // Save anomalies to DB and notify
  if (anomalies.length > 0) {
    const rows = anomalies.map(a => ({
      store_id: a.store_id,
      alert_type: a.alert_type,
      severity: a.severity,
      metric_value: a.metric_value,
      threshold_value: a.threshold_value,
      message: a.message,
    }))

    await supabase
      .from('anomaly_alerts')
      .upsert(rows, { onConflict: 'store_id,alert_type,created_at' })

    // Send email notification
    const storeIds = Array.from(new Set(anomalies.map(a => a.store_id)))
    await sendAlertEmail(anomalies, storeIds)

    // Update notified_at
    const { data: inserted } = await supabase
      .from('anomaly_alerts')
      .select('id')
      .gte('created_at', `${yesterday}T00:00:00`)
      .in('alert_type', anomalies.map(a => a.alert_type))

    if (inserted) {
      for (const row of inserted) {
        await supabase
          .from('anomaly_alerts')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', row.id)
      }
    }
  }

  return anomalies
}
