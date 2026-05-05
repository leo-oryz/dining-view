// Facebook Page Graph API response shapes.
// ⚠️ Verify against https://developers.facebook.com/docs/graph-api/reference/page

export interface FBPageProfile {
  id: string
  name?: string
  fan_count?: number
  followers_count?: number
}

export interface FBInsightValue {
  value: number
  end_time?: string
}

export interface FBInsightDataPoint {
  name: string
  period?: string
  values: FBInsightValue[]
}

export interface FBInsightsResponse {
  data: FBInsightDataPoint[]
}

export interface FBSummaryCount {
  data?: unknown[]
  summary?: { total_count?: number }
}

export interface FBPost {
  id: string
  created_time?: string
  message?: string
  likes?: FBSummaryCount
  comments?: FBSummaryCount
  shares?: { count?: number }
  reactions?: FBSummaryCount
}

export interface FBPostListResponse {
  data: FBPost[]
  paging?: { cursors?: { after?: string }; next?: string }
}
