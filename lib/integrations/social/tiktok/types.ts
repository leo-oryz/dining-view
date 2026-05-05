// TikTok for Business API response shapes.
// ⚠️ Verify against https://business-api.tiktok.com/portal/docs once the dev
// account is approved — field names below follow the v1.3 docs as of 2025.

export interface TTBusinessAccount {
  business_id?: string
  display_name?: string
  username?: string
  followers_count?: number
  profile_views?: number
  likes_count?: number
}

export interface TTVideoListItem {
  item_id: string
  create_time?: number // unix seconds
  caption?: string
  video_views?: number
  likes?: number
  comments?: number
  shares?: number
  reach?: number
  impressions?: number
}

export interface TTApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
}

export interface TTVideoListData {
  videos?: TTVideoListItem[]
  cursor?: string | null
  has_more?: boolean
}
