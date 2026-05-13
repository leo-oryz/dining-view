// Instagram Graph API response shapes (post v22 deprecation, 2025-04).
// Reference: https://developers.facebook.com/docs/instagram-platform/api-reference/

export interface IGUserProfile {
  id: string
  username?: string
  followers_count?: number
  media_count?: number
}

export interface IGInsightValue {
  value: number
  end_time?: string // ISO8601 (present for time-series; absent for media insights)
}

export interface IGInsightDataPoint {
  name: string
  period?: string
  values?: IGInsightValue[]
  // For metric_type=total_value responses:
  total_value?: { value?: number }
}

export interface IGInsightsResponse {
  data: IGInsightDataPoint[]
}

// Period-level totals (the post-v22 replacement for per-day metrics).
export interface IGTotals {
  views?: number | null
  profile_links_taps?: number | null
  total_interactions?: number | null
  accounts_engaged?: number | null
  likes?: number | null
  comments?: number | null
  saves?: number | null
  shares?: number | null
}

export interface IGMedia {
  id: string
  media_type?: string // 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type?: string // 'FEED' | 'REELS' | 'STORY'
  caption?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
  // Insights fields fetched per-media (post-v22 — `views` replaces impressions & video_views):
  reach?: number
  views?: number
  saves?: number
  shares?: number
  total_interactions?: number
}

export interface IGMediaListResponse {
  data: IGMedia[]
  paging?: { cursors?: { after?: string }; next?: string }
}
