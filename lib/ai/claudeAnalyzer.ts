import Anthropic from '@anthropic-ai/sdk'
import { AnalysisContext } from './dataPrep'
import { ProductPair } from './basketAnalysis'
import { SkuMargin } from './marginMatrix'

const MAX_RETRIES = 2

type ReportType = 'attribution' | 'star_products' | 'retire_candidates' | 'expansion'

export async function analyzeWithClaude(
  reportType: ReportType,
  context: AnalysisContext,
  basketPairs: ProductPair[],
  marginMatrix: SkuMargin[]
): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })
  const prompt = buildPrompt(reportType, context, basketPairs, marginMatrix)
  const systemPrompt = getSystemPrompt(reportType)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        system: systemPrompt,
      })

      const textBlock = message.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text in Claude response')
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = textBlock.text.trim()
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)
      return parsed
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) continue
    }
  }

  throw lastError || new Error('Claude analysis failed')
}

function getSystemPrompt(reportType: ReportType): string {
  const base = `你是 FnB Pulse 餐飲智慧分析助理。你的任務是根據提供的營運數據產生結構化的 JSON 分析報告。
規則：
- 只輸出有效的 JSON，不要加任何說明文字
- 所有文字用繁體中文
- 數字要精確，引用具體數據作為 evidence
- confidence 只能是 "high"、"medium"、"low"
- 日期格式 YYYY-MM-DD`

  const schemas: Record<ReportType, string> = {
    attribution: `${base}

輸出格式：
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "summary": "2-3 句執行摘要",
  "anomalies": [
    {
      "date": "YYYY-MM-DD",
      "revenue_delta_pct": number,
      "likely_cause": "string",
      "evidence": "具體數字",
      "confidence": "high | medium | low"
    }
  ],
  "top_drivers": [
    {
      "factor": "campaign | weather | competitor | line_broadcast | ads",
      "name": "string",
      "impact_estimate": "string",
      "evidence": "string"
    }
  ],
  "recommendations": ["string"]
}`,
    star_products: `${base}

輸出格式：
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "summary": "string",
  "stars": [
    {
      "product_name": "string",
      "category": "string",
      "gross_margin": number (0-1),
      "qty_trend_pct": number,
      "basket_affinity": ["常一起購買的商品"],
      "recommendation": "string",
      "evidence": "string"
    }
  ]
}`,
    retire_candidates: `${base}

輸出格式：
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "summary": "string",
  "candidates": [
    {
      "product_name": "string",
      "category": "string",
      "gross_margin": number (0-1),
      "qty_trend_pct": number,
      "basket_risk": "會被影響的商品",
      "verdict": "retire | caution | monitor",
      "reason": "string",
      "evidence": "string"
    }
  ]
}`,
    expansion: `${base}

你正在協助餐飲集團評估展店準備度。根據現有店鋪的營運數據，分析並建議新店的最佳型態。

輸出格式：
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "summary": "2-3 句展店準備度評估",
  "strengths": ["string — 展店有利因素"],
  "risks": ["string — 展店風險因素"],
  "optimal_format": "string — 建議店型，例如 外帶為主、60席以下",
  "target_demographic": "string — 目標客群描述",
  "recommended_hours": "string — 建議營業時段",
  "revenue_benchmark": {
    "daily_avg": number,
    "per_seat_daily": number
  },
  "recommendations": ["string — 具體建議行動"]
}`,
  }

  return schemas[reportType]
}

function buildPrompt(
  reportType: ReportType,
  ctx: AnalysisContext,
  basketPairs: ProductPair[],
  marginMatrix: SkuMargin[]
): string {
  const sections: string[] = []

  sections.push(`# 分析請求：${reportType}`)
  sections.push(`店家：${ctx.storeName}`)
  sections.push(`分析期間：${ctx.periodStart} ~ ${ctx.periodEnd}`)

  // Daily sales
  if (ctx.dailySales.length > 0) {
    sections.push('\n## 每日營收')
    sections.push('date | net_sales | guests | orders | avg_spending | member_visits | new_members')
    for (const row of ctx.dailySales) {
      sections.push(
        `${row.date} | ${row.net_sales ?? '-'} | ${row.guests ?? '-'} | ${row.orders ?? '-'} | ${row.avg_spending ?? '-'} | ${row.member_visits ?? '-'} | ${row.new_members ?? '-'}`
      )
    }
  }

  // Product sales (top 50 by revenue)
  if (ctx.productSales.length > 0) {
    sections.push('\n## 商品銷售 (依營收排序，前50)')
    sections.push('product_name | category | quantity_sold | revenue | gross_margin')
    for (const row of ctx.productSales.slice(0, 50)) {
      sections.push(
        `${row.product_name} | ${row.category ?? '-'} | ${row.quantity_sold ?? '-'} | ${row.revenue ?? '-'} | ${row.gross_margin ?? '-'}`
      )
    }
  }

  // Margin matrix
  if (marginMatrix.length > 0) {
    sections.push('\n## 毛利矩陣')
    sections.push('product_name | category | total_qty | total_revenue | gross_margin')
    for (const row of marginMatrix.slice(0, 40)) {
      sections.push(
        `${row.product_name} | ${row.category ?? '-'} | ${row.total_quantity} | ${row.total_revenue} | ${(row.gross_margin * 100).toFixed(1)}%`
      )
    }
  }

  // Basket pairs
  if (basketPairs.length > 0) {
    sections.push('\n## 購物籃配對 (前20)')
    sections.push('product_a | product_b | co_occurrence')
    for (const pair of basketPairs) {
      sections.push(`${pair.product_a} | ${pair.product_b} | ${pair.co_occurrence}`)
    }
  }

  // Campaigns
  if (ctx.campaigns.length > 0) {
    sections.push('\n## 活動')
    const dayLabels = ['日', '一', '二', '三', '四', '五', '六']
    for (const c of ctx.campaigns) {
      if (c.recurrence_type === 'weekly' && c.recurrence_days) {
        const days = c.recurrence_days.map((d) => dayLabels[d]).join('、')
        // Find which dates in the analysis period match the recurrence days
        const matchingDates: string[] = []
        const start = new Date(Math.max(new Date(ctx.periodStart).getTime(), new Date(c.start_date || ctx.periodStart).getTime()))
        const end = c.end_date
          ? new Date(Math.min(new Date(ctx.periodEnd).getTime(), new Date(c.end_date).getTime()))
          : new Date(ctx.periodEnd)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (c.recurrence_days.includes(d.getDay())) {
            matchingDates.push(d.toISOString().slice(0, 10))
          }
        }
        sections.push(`- ${c.name} (${c.type || '未分類'}) 週期:每週${days} 生效:${c.start_date || '?'}~ 狀態:${c.status} 預算:${c.budget ?? '-'} 本期適用日:${matchingDates.join(',')}`)
      } else {
        sections.push(`- ${c.name} (${c.type || '未分類'}) ${c.start_date || '?'}~${c.end_date || '?'} 狀態:${c.status} 預算:${c.budget ?? '-'}`)
      }
    }
  }

  // Weather
  if (ctx.weather.length > 0) {
    sections.push('\n## 天氣')
    sections.push('date | temp_high | temp_low | precipitation | description')
    for (const w of ctx.weather) {
      sections.push(
        `${w.date} | ${w.temp_high ?? '-'}°C | ${w.temp_low ?? '-'}°C | ${w.precipitation ?? 0}mm | ${w.description ?? '-'}`
      )
    }
  }

  // Ad campaigns
  if (ctx.adCampaigns.length > 0) {
    sections.push('\n## 廣告投放')
    sections.push('date | platform | campaign_name | spend | clicks | roas')
    for (const a of ctx.adCampaigns) {
      sections.push(
        `${a.date} | ${a.platform} | ${a.campaign_name} | ${a.spend ?? '-'} | ${a.clicks ?? '-'} | ${a.roas ?? '-'}`
      )
    }
  }

  // Member snapshots
  if (ctx.memberSnapshots.length > 0) {
    sections.push('\n## 會員趨勢')
    sections.push('date | total_members | new_members')
    for (const m of ctx.memberSnapshots) {
      sections.push(`${m.snapshot_date} | ${m.total_members ?? '-'} | ${m.new_members ?? '-'}`)
    }
  }

  if (reportType === 'expansion') {
    sections.push('\n請根據以上數據評估展店準備度，重點關注：')
    sections.push('1. 哪些時段表現最佳（從每日營收和商品銷售推斷）')
    sections.push('2. 哪些商品類別是核心營收來源')
    sections.push('3. 會員結構是否健康（回訪率、新客佔比）')
    sections.push('4. 營收穩定性和季節性趨勢')
    sections.push('5. 新店應該採取什麼型態（外帶、內用、複合）')
  }

  sections.push('\n請根據以上數據產生分析報告 JSON。')

  return sections.join('\n')
}
