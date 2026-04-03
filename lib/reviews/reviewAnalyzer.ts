import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

const MAX_RETRIES = 2

export interface NegativeTheme {
  theme: string
  frequency: number
  example_quote: string
  severity: 'high' | 'medium' | 'low'
}

export interface ReviewAnalysis {
  negative_themes: NegativeTheme[]
  sentiment_trend: 'improving' | 'stable' | 'declining'
  trend_reason: string
  keywords: string[]
  overall_summary: string
}

/**
 * Analyze recent negative reviews using Claude.
 * Fetches last 4 weeks of negative reviews and generates themes + sentiment.
 */
export async function analyzeNegativeReviews(
  storeId: string
): Promise<ReviewAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const supabase = createServiceClient()

  // Last 4 weeks of negative reviews
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const sinceDate = fourWeeksAgo.toISOString().split('T')[0]

  const { data: negativeReviews } = await supabase
    .from('google_reviews')
    .select('rating, review_text, review_date, reviewer_name')
    .eq('store_id', storeId)
    .eq('is_negative', true)
    .gte('review_date', sinceDate)
    .order('review_date', { ascending: false })

  if (!negativeReviews || negativeReviews.length === 0) {
    return {
      negative_themes: [],
      sentiment_trend: 'stable',
      trend_reason: '近 4 週無負面評論',
      keywords: [],
      overall_summary: '近 4 週無負面評論，顧客滿意度良好。',
    }
  }

  // Also fetch all reviews for sentiment trend comparison
  const { data: allRecentReviews } = await supabase
    .from('google_reviews')
    .select('rating, review_date')
    .eq('store_id', storeId)
    .gte('review_date', sinceDate)
    .order('review_date')

  const reviewTexts = negativeReviews
    .filter(r => r.review_text)
    .map((r, i) => `[${i + 1}] ${r.review_date} | ${r.rating}星 | ${r.review_text}`)
    .join('\n')

  const totalReviews = allRecentReviews?.length || 0
  const negCount = negativeReviews.length

  const prompt = `以下是一間餐廳近 4 週的負面評論（3 星及以下），共 ${negCount} 則（總評論 ${totalReviews} 則）：

${reviewTexts}

請分析這些負面評論，找出重複出現的問題主題。

輸出 JSON 格式：
{
  "negative_themes": [
    {
      "theme": "問題主題名稱",
      "frequency": 出現次數,
      "example_quote": "最具代表性的引用",
      "severity": "high | medium | low"
    }
  ],
  "sentiment_trend": "improving | stable | declining",
  "trend_reason": "趨勢原因",
  "keywords": ["關鍵字1", "關鍵字2"],
  "overall_summary": "整體摘要（2-3 句）"
}

severity 判斷標準：
- high: 影響食品安全或重複出現 3 次以上
- medium: 服務或環境問題，出現 2 次以上
- low: 個別偏好或偶發事件

只輸出 JSON，不要加任何說明文字。`

  const client = new Anthropic({ apiKey })
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        system: '你是餐飲業顧客評論分析專家。根據提供的負面評論產生結構化分析。只輸出有效的 JSON。所有文字用繁體中文。',
      })

      const textBlock = message.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text in Claude response')
      }

      // Strip markdown fences
      let jsonStr = textBlock.text.trim()
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim()
      }

      const parsed: ReviewAnalysis = JSON.parse(jsonStr)
      return parsed
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) continue
    }
  }

  throw lastError || new Error('Review analysis failed')
}

/**
 * Create a weekly snapshot with AI analysis.
 */
export async function createReviewSnapshot(
  storeId: string,
  snapshotDate: string
): Promise<void> {
  const supabase = createServiceClient()

  // Total reviews count
  const { count: totalReviews } = await supabase
    .from('google_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)

  // Average rating (all time)
  const { data: ratingData } = await supabase
    .from('google_reviews')
    .select('rating')
    .eq('store_id', storeId)
    .not('rating', 'is', null)

  const avgRating = ratingData && ratingData.length > 0
    ? ratingData.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingData.length
    : null

  // New reviews this week
  const weekAgo = new Date(snapshotDate)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  const { data: newReviews } = await supabase
    .from('google_reviews')
    .select('rating')
    .eq('store_id', storeId)
    .gte('review_date', weekAgoStr)
    .lte('review_date', snapshotDate)

  const newReviewsCount = newReviews?.length || 0
  const negativeCount = (newReviews || []).filter(r => r.rating != null && r.rating <= 3).length

  // Rating breakdown
  const breakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  for (const r of ratingData || []) {
    if (r.rating && r.rating >= 1 && r.rating <= 5) {
      breakdown[String(r.rating)]++
    }
  }

  // AI analysis
  let aiSummary: string | null = null
  let aiSentimentTrend: string | null = null
  let keywords: string[] = []

  try {
    const analysis = await analyzeNegativeReviews(storeId)
    aiSummary = analysis.overall_summary
    aiSentimentTrend = analysis.sentiment_trend
    keywords = analysis.keywords
  } catch (err) {
    console.error('[reviewAnalyzer] AI analysis failed:', err)
  }

  // Upsert snapshot
  const { error } = await supabase
    .from('google_review_snapshots')
    .upsert({
      store_id: storeId,
      snapshot_date: snapshotDate,
      total_reviews: totalReviews || 0,
      avg_rating: avgRating ? Number(avgRating.toFixed(2)) : null,
      new_reviews_count: newReviewsCount,
      negative_count: negativeCount,
      rating_breakdown: breakdown,
      ai_negative_summary: aiSummary,
      ai_sentiment_trend: aiSentimentTrend,
      keywords,
    }, { onConflict: 'store_id,snapshot_date' })

  if (error) throw new Error(`Failed to save snapshot: ${error.message}`)
}
