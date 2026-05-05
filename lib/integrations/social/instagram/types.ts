// Instagram Graph API response shapes.
// ⚠️ Verify field names against https://developers.facebook.com/docs/instagram-api
// once the access token is provisioned.

export interface IGUserProfile {
  id: string
  username?: string
  followers_count?: number
  media_count?: number
}

export interface IGInsightValue {
  value: number
  end_time?: string // ISO8601
}

export interface IGInsightDataPoint {
  name: string // 'reach' | 'impressions' | 'profile_views' | 'website_clicks'
  period?: string // 'day'
  values: IGInsightValue[]
}

export interface IGInsightsResponse {
  data: IGInsightDataPoint[]
}

export interface IGMedia {
  id: string
  media_type?: string // 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS'
  media_product_type?: string // 'FEED' | 'REELS' | 'STORY'
  caption?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
  // Insights fields fetched per-media:
  reach?: number
  impressions?: number
  saved?: number
  shares?: number
  video_views?: number
}

export interface IGMediaListResponse {
  data: IGMedia[]
  paging?: { cursors?: { after?: string }; next?: string }
}
