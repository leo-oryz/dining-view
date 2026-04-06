import { SupabaseClient } from '@supabase/supabase-js'
import { detectProductAnomalies, type ProductAnomaly } from '@/lib/products/anomalyDetector'

export interface AnalysisContext {
  storeName: string
  periodStart: string
  periodEnd: string
  dailySales: DailySalesRow[]
  productSales: ProductSalesRow[]
  campaigns: CampaignRow[]
  weather: WeatherRow[]
  adCampaigns: AdCampaignRow[]
  memberSnapshots: MemberSnapshotRow[]
  reviewSnapshots: ReviewSnapshotRow[]
  kolCollaborations: KolCollaborationRow[]
  productAnomalies: ProductAnomaly[]
}

interface DailySalesRow {
  date: string
  net_sales: number | null
  guests: number | null
  orders: number | null
  avg_spending: number | null
  member_visits: number | null
  new_members: number | null
}

interface ProductSalesRow {
  date: string
  product_name: string
  category: string | null
  quantity_sold: number | null
  revenue: number | null
  gross_profit: number | null
  gross_margin: number | null
}

interface CampaignRow {
  name: string
  type: string | null
  start_date: string | null
  end_date: string | null
  status: string
  budget: number | null
  recurrence_type: string
  recurrence_days: number[] | null
}

interface WeatherRow {
  date: string
  temp_high: number | null
  temp_low: number | null
  precipitation: number | null
  description: string | null
}

interface AdCampaignRow {
  date: string
  platform: string
  campaign_name: string
  spend: number | null
  clicks: number | null
  impressions: number | null
  roas: number | null
}

interface MemberSnapshotRow {
  snapshot_date: string
  total_members: number | null
  new_members: number | null
}

interface ReviewSnapshotRow {
  snapshot_date: string
  avg_rating: number | null
  new_reviews_count: number | null
  negative_count: number | null
  ai_negative_summary: string | null
  ai_sentiment_trend: string | null
  keywords: string[] | null
}

interface KolCollaborationRow {
  kol_name: string
  collaboration_date: string
  featured_products: string[]
  collaboration_fee: number | null
  platforms: string[]
  total_views: number
  total_engagement: number
}

export async function prepareAnalysisContext(
  supabase: SupabaseClient,
  storeId: string,
  periodStart: string,
  periodEnd: string
): Promise<AnalysisContext> {
  const [
    storeRes,
    salesRes,
    productsRes,
    campaignsRes,
    weatherRes,
    adsRes,
    membersRes,
    reviewsRes,
    kolRes,
  ] = await Promise.all([
    supabase.from('stores').select('name').eq('id', storeId).single(),
    supabase
      .from('daily_sales')
      .select('date, net_sales, guests, orders, avg_spending, member_visits, new_members')
      .eq('store_id', storeId)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date'),
    supabase
      .from('product_sales')
      .select('date, product_name, category, quantity_sold, revenue, gross_profit, gross_margin')
      .eq('store_id', storeId)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('revenue', { ascending: false }),
    supabase
      .from('campaigns')
      .select('name, type, start_date, end_date, status, budget, recurrence_type, recurrence_days')
      .eq('store_id', storeId)
      .or(`and(recurrence_type.eq.once,start_date.lte.${periodEnd},end_date.gte.${periodStart}),and(recurrence_type.eq.weekly,start_date.lte.${periodEnd},or(end_date.is.null,end_date.gte.${periodStart}))`)
      .order('start_date'),
    supabase
      .from('weather_daily')
      .select('date, temp_high, temp_low, precipitation, description')
      .eq('store_id', storeId)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date'),
    supabase
      .from('ad_campaigns')
      .select('date, platform, campaign_name, spend, clicks, impressions, roas')
      .eq('store_id', storeId)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date'),
    supabase
      .from('ocard_member_snapshots')
      .select('snapshot_date, total_members, new_members')
      .eq('store_id', storeId)
      .gte('snapshot_date', periodStart)
      .lte('snapshot_date', periodEnd)
      .order('snapshot_date'),
    supabase
      .from('google_review_snapshots')
      .select('snapshot_date, avg_rating, new_reviews_count, negative_count, ai_negative_summary, ai_sentiment_trend, keywords')
      .eq('store_id', storeId)
      .gte('snapshot_date', periodStart)
      .lte('snapshot_date', periodEnd)
      .order('snapshot_date'),
    supabase
      .from('kol_collaborations')
      .select('kol_name, collaboration_date, featured_products, collaboration_fee, kol_posts(platform, views, likes, comments, shares)')
      .eq('store_id', storeId)
      .gte('collaboration_date', periodStart)
      .lte('collaboration_date', periodEnd)
      .order('collaboration_date'),
  ])

  // Detect product anomalies for the analysis period
  const productAnomalies = await detectProductAnomalies(supabase, storeId, periodStart, periodEnd)

  return {
    storeName: storeRes.data?.name || 'Unknown',
    periodStart,
    periodEnd,
    dailySales: salesRes.data || [],
    productSales: productsRes.data || [],
    campaigns: campaignsRes.data || [],
    weather: weatherRes.data || [],
    adCampaigns: adsRes.data || [],
    memberSnapshots: membersRes.data || [],
    reviewSnapshots: reviewsRes.data || [],
    productAnomalies,
    kolCollaborations: (kolRes.data || []).map((c: { kol_name: string; collaboration_date: string; featured_products: string[]; collaboration_fee: number | null; kol_posts: { platform: string; views: number | null; likes: number | null; comments: number | null; shares: number | null }[] }) => {
      const posts = c.kol_posts || []
      return {
        kol_name: c.kol_name,
        collaboration_date: c.collaboration_date,
        featured_products: c.featured_products,
        collaboration_fee: c.collaboration_fee,
        platforms: Array.from(new Set(posts.map(p => p.platform))),
        total_views: posts.reduce((s, p) => s + (p.views || 0), 0),
        total_engagement: posts.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0),
      }
    }),
  }
}
