import { SupabaseClient } from '@supabase/supabase-js'
import { getWeatherType, isTyphoon, type WeatherDaily } from '@/lib/weather/weatherUtils'

export interface ProductAnomaly {
  product_name: string
  category: string | null
  anomaly_date: string
  anomaly_type: 'spike' | 'drop'
  actual_qty: number
  baseline_qty: number
  delta_pct: number
  weather_type: string
  is_typhoon_day: boolean
  has_campaign: boolean
  campaign_name: string | null
  has_kol: boolean
  kol_name: string | null
}

interface DailySale {
  date: string
  product_name: string
  category: string | null
  quantity_sold: number
}

interface Campaign {
  name: string
  start_date: string | null
  end_date: string | null
  recurrence_type: string
  recurrence_days: number[] | null
}

/**
 * Check if a campaign is active on a given date, handling weekly recurrence.
 */
function isCampaignActiveOnDate(campaign: Campaign, date: string): boolean {
  const d = new Date(date)
  const start = campaign.start_date ? new Date(campaign.start_date) : null
  const end = campaign.end_date ? new Date(campaign.end_date) : null

  if (start && d < start) return false
  if (end && d > end) return false

  if (campaign.recurrence_type === 'weekly' && campaign.recurrence_days) {
    // JS getDay(): 0=Sun, 1=Mon ... 6=Sat
    const dayOfWeek = d.getDay()
    return campaign.recurrence_days.includes(dayOfWeek)
  }

  // For 'once' campaigns, being within start-end range is enough
  return true
}

/**
 * Detect product sales anomalies for a given store and date range.
 * Uses 14-day rolling baseline per product.
 */
export async function detectProductAnomalies(
  supabase: SupabaseClient,
  storeId: string,
  from: string,
  to: string,
  type: 'spike' | 'drop' | 'all' = 'all'
): Promise<ProductAnomaly[]> {
  // Extend window 14 days before `from` to build baseline
  const baselineStart = new Date(from)
  baselineStart.setDate(baselineStart.getDate() - 14)
  const baselineStartStr = baselineStart.toISOString().split('T')[0]

  // Fetch product sales for extended window
  const { data: salesData } = await supabase
    .from('product_sales')
    .select('date, product_name, category, quantity_sold')
    .eq('store_id', storeId)
    .gte('date', baselineStartStr)
    .lte('date', to)
    .not('quantity_sold', 'is', null)
    .order('date')

  if (!salesData || salesData.length === 0) return []

  // Fetch context data in parallel
  const [weatherRes, campaignsRes, kolRes] = await Promise.all([
    supabase
      .from('weather_daily')
      .select('date, temp_high, temp_low, humidity, precipitation, weather_code, description')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('campaigns')
      .select('name, start_date, end_date, recurrence_type, recurrence_days')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .or(`and(recurrence_type.eq.once,start_date.lte.${to},end_date.gte.${from}),and(recurrence_type.eq.weekly,start_date.lte.${to},or(end_date.is.null,end_date.gte.${from}))`),
    supabase
      .from('kol_posts')
      .select('post_date, collaboration:kol_collaborations(kol_name)')
      .eq('store_id', storeId)
      .gte('post_date', from)
      .lte('post_date', to),
  ])

  // Build weather map
  const weatherMap = new Map<string, WeatherDaily>()
  for (const w of (weatherRes.data || []) as WeatherDaily[]) {
    weatherMap.set(w.date, w)
  }

  // Build campaigns list
  const campaigns: Campaign[] = (campaignsRes.data || []) as Campaign[]

  // Build KOL map: date -> kol_name
  const kolMap = new Map<string, string>()
  for (const post of (kolRes.data || []) as Array<Record<string, unknown>>) {
    const postDate = post.post_date as string | null
    const collab = post.collaboration as Record<string, unknown> | Record<string, unknown>[] | null
    const kolName = Array.isArray(collab) ? (collab[0]?.kol_name as string | undefined) : (collab?.kol_name as string | undefined)
    if (postDate && kolName) {
      kolMap.set(postDate, kolName)
    }
  }

  // Group sales by product -> date -> quantity
  const productSales = new Map<string, { category: string | null; dailyQty: Map<string, number> }>()
  for (const row of salesData as DailySale[]) {
    const qty = Number(row.quantity_sold) || 0
    if (qty <= 0) continue

    let entry = productSales.get(row.product_name)
    if (!entry) {
      entry = { category: row.category, dailyQty: new Map() }
      productSales.set(row.product_name, entry)
    }
    // Accumulate if same product appears multiple times on same date
    entry.dailyQty.set(row.date, (entry.dailyQty.get(row.date) || 0) + qty)
  }

  const anomalies: ProductAnomaly[] = []
  const fromDate = new Date(from)
  const toDate = new Date(to)

  const productNames = Array.from(productSales.keys())
  for (const productName of productNames) {
    const entry = productSales.get(productName)!

    // Iterate each date in the [from, to] range
    const current = new Date(fromDate)
    while (current <= toDate) {
      const dateStr = current.toISOString().split('T')[0]
      const actualQty = entry.dailyQty.get(dateStr)

      if (actualQty != null) {
        // Build 14-day baseline (excluding current date)
        const baselineDays: number[] = []
        for (let i = 1; i <= 14; i++) {
          const baseDate = new Date(current)
          baseDate.setDate(baseDate.getDate() - i)
          const baseDateStr = baseDate.toISOString().split('T')[0]
          const qty = entry.dailyQty.get(baseDateStr)
          if (qty != null) baselineDays.push(qty)
        }

        // Need at least 5 days of data
        if (baselineDays.length >= 5) {
          const baseline = baselineDays.reduce((a, b) => a + b, 0) / baselineDays.length

          // Skip low-volume products
          if (baseline >= 3) {
            let anomalyType: 'spike' | 'drop' | null = null
            let deltaPct = 0

            if (actualQty > baseline * 2.0) {
              anomalyType = 'spike'
              deltaPct = Math.round(((actualQty - baseline) / baseline) * 100)
            } else if (actualQty < baseline * 0.3) {
              anomalyType = 'drop'
              deltaPct = Math.round(((actualQty - baseline) / baseline) * 100)
            }

            if (anomalyType && (type === 'all' || type === anomalyType)) {
              const weather = weatherMap.get(dateStr)
              const weatherType = weather ? getWeatherType(weather) : 'other'
              const isTyphoonDay = weather ? isTyphoon(weather) : false

              // Find active campaign
              let campaignName: string | null = null
              for (const c of campaigns) {
                if (isCampaignActiveOnDate(c, dateStr)) {
                  campaignName = c.name
                  break
                }
              }

              const kolName = kolMap.get(dateStr) || null

              anomalies.push({
                product_name: productName,
                category: entry.category,
                anomaly_date: dateStr,
                anomaly_type: anomalyType,
                actual_qty: actualQty,
                baseline_qty: Math.round(baseline),
                delta_pct: deltaPct,
                weather_type: weatherType,
                is_typhoon_day: isTyphoonDay,
                has_campaign: campaignName !== null,
                campaign_name: campaignName,
                has_kol: kolName !== null,
                kol_name: kolName,
              })
            }
          }
        }
      }

      current.setDate(current.getDate() + 1)
    }
  }

  // Sort by date descending
  anomalies.sort((a, b) => b.anomaly_date.localeCompare(a.anomaly_date))

  return anomalies
}

/**
 * Get single product daily trend with moving average and anomaly markers.
 */
export async function getProductTrend(
  supabase: SupabaseClient,
  storeId: string,
  productName: string,
  from: string,
  to: string
) {
  // Extend 14 days before for moving average calculation
  const extendedStart = new Date(from)
  extendedStart.setDate(extendedStart.getDate() - 14)
  const extendedStartStr = extendedStart.toISOString().split('T')[0]

  const [salesRes, weatherRes, campaignsRes, kolRes] = await Promise.all([
    supabase
      .from('product_sales')
      .select('date, quantity_sold')
      .eq('store_id', storeId)
      .eq('product_name', productName)
      .gte('date', extendedStartStr)
      .lte('date', to)
      .not('quantity_sold', 'is', null)
      .order('date'),
    supabase
      .from('weather_daily')
      .select('date, temp_high, temp_low, humidity, precipitation, weather_code, description')
      .eq('store_id', storeId)
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('campaigns')
      .select('name, start_date, end_date, recurrence_type, recurrence_days')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .or(`and(recurrence_type.eq.once,start_date.lte.${to},end_date.gte.${from}),and(recurrence_type.eq.weekly,start_date.lte.${to},or(end_date.is.null,end_date.gte.${from}))`),
    supabase
      .from('kol_posts')
      .select('post_date, collaboration:kol_collaborations(kol_name)')
      .eq('store_id', storeId)
      .gte('post_date', from)
      .lte('post_date', to),
  ])

  // Build daily quantity map (extended range)
  const dailyQtyMap = new Map<string, number>()
  for (const row of (salesRes.data || []) as { date: string; quantity_sold: number }[]) {
    const qty = Number(row.quantity_sold) || 0
    dailyQtyMap.set(row.date, (dailyQtyMap.get(row.date) || 0) + qty)
  }

  // Weather map
  const weatherMap = new Map<string, WeatherDaily>()
  for (const w of (weatherRes.data || []) as WeatherDaily[]) {
    weatherMap.set(w.date, w)
  }

  const campaigns = (campaignsRes.data || []) as Campaign[]
  const kolMap = new Map<string, string>()
  for (const post of (kolRes.data || []) as Array<Record<string, unknown>>) {
    const postDate = post.post_date as string | null
    const collab = post.collaboration as Record<string, unknown> | Record<string, unknown>[] | null
    const kolName = Array.isArray(collab) ? (collab[0]?.kol_name as string | undefined) : (collab?.kol_name as string | undefined)
    if (postDate && kolName) {
      kolMap.set(postDate, kolName)
    }
  }

  // Build trend data for [from, to] range
  const trend: Array<{
    date: string
    quantity: number
    moving_avg: number | null
    anomaly_type: 'spike' | 'drop' | null
    delta_pct: number | null
    weather_type: string
    weather_icon: string
    has_campaign: boolean
    campaign_name: string | null
    has_kol: boolean
    kol_name: string | null
  }> = []

  const fromDate = new Date(from)
  const toDate = new Date(to)
  const current = new Date(fromDate)

  while (current <= toDate) {
    const dateStr = current.toISOString().split('T')[0]
    const quantity = dailyQtyMap.get(dateStr) || 0

    // 14-day moving average
    const maDays: number[] = []
    for (let i = 0; i <= 13; i++) {
      const maDate = new Date(current)
      maDate.setDate(maDate.getDate() - i)
      const maDateStr = maDate.toISOString().split('T')[0]
      const qty = dailyQtyMap.get(maDateStr)
      if (qty != null) maDays.push(qty)
    }
    const movingAvg = maDays.length >= 3
      ? Math.round((maDays.reduce((a, b) => a + b, 0) / maDays.length) * 10) / 10
      : null

    // Anomaly detection on this point
    const baselineDays: number[] = []
    for (let i = 1; i <= 14; i++) {
      const baseDate = new Date(current)
      baseDate.setDate(baseDate.getDate() - i)
      const baseDateStr = baseDate.toISOString().split('T')[0]
      const qty = dailyQtyMap.get(baseDateStr)
      if (qty != null) baselineDays.push(qty)
    }

    let anomalyType: 'spike' | 'drop' | null = null
    let deltaPct: number | null = null
    if (baselineDays.length >= 5) {
      const baseline = baselineDays.reduce((a, b) => a + b, 0) / baselineDays.length
      if (baseline >= 3) {
        if (quantity > baseline * 2.0) {
          anomalyType = 'spike'
          deltaPct = Math.round(((quantity - baseline) / baseline) * 100)
        } else if (quantity < baseline * 0.3) {
          anomalyType = 'drop'
          deltaPct = Math.round(((quantity - baseline) / baseline) * 100)
        }
      }
    }

    const weather = weatherMap.get(dateStr)
    const weatherType = weather ? getWeatherType(weather) : 'other'

    let campaignName: string | null = null
    for (const c of campaigns) {
      if (isCampaignActiveOnDate(c, dateStr)) {
        campaignName = c.name
        break
      }
    }

    const kolName = kolMap.get(dateStr) || null

    trend.push({
      date: dateStr,
      quantity,
      moving_avg: movingAvg,
      anomaly_type: anomalyType,
      delta_pct: deltaPct,
      weather_type: weatherType,
      weather_icon: weather ? `${getWeatherType(weather)}` : 'other',
      has_campaign: campaignName !== null,
      campaign_name: campaignName,
      has_kol: kolName !== null,
      kol_name: kolName,
    })

    current.setDate(current.getDate() + 1)
  }

  // Get category
  const { data: productInfo } = await supabase
    .from('product_sales')
    .select('category')
    .eq('store_id', storeId)
    .eq('product_name', productName)
    .not('category', 'is', null)
    .limit(1)
    .single()

  return {
    product_name: productName,
    category: productInfo?.category || null,
    trend,
  }
}
