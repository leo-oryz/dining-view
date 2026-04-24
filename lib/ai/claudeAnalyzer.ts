import Anthropic from '@anthropic-ai/sdk'
import { AnalysisContext } from './dataPrep'
import { ProductPair } from './basketAnalysis'
import { SkuMargin } from './marginMatrix'
import { LaborContext } from './laborDataPrep'

const MAX_RETRIES = 2

type ReportType = 'attribution' | 'star_products' | 'retire_candidates' | 'expansion' | 'labor_cost'

export async function analyzeWithClaude(
  reportType: ReportType,
  context: AnalysisContext | LaborContext,
  basketPairs: ProductPair[],
  marginMatrix: SkuMargin[]
): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })
  const prompt = reportType === 'labor_cost'
    ? buildLaborPrompt(context as LaborContext)
    : buildPrompt(reportType, context as AnalysisContext, basketPairs, marginMatrix)
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
- 日期格式 YYYY-MM-DD
- 「商品銷量異常」資料包含以 14 日移動均線為基準偵測到的暴增(spike >200%)和驟降(drop <30%)，並附帶天氣、活動、KOL 等背景。請在分析中交叉引用這些異常來增強你的判斷`

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
      "factor": "campaign | weather | competitor | line_broadcast | ads | product_anomaly",
      "name": "string",
      "impact_estimate": "string",
      "evidence": "string"
    }
  ],
  "recommendations": ["string"]
}`,
    star_products: `${base}

重要：毛利矩陣中的 qty_trend_pct 是本期銷量與前一同長度期間的比較（已預先計算），請直接使用此數值作為 stars 中的 qty_trend_pct，不要自行推算。

輸出格式：
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "summary": "string",
  "stars": [
    {
      "product_name": "string",
      "category": "string",
      "gross_margin": number (0-1),
      "qty_trend_pct": number (直接使用毛利矩陣中的 qty_trend_pct 值),
      "basket_affinity": ["常一起購買的商品"],
      "anomaly_flag": "spike | drop | none — 該商品近期是否出現銷量異常",
      "recommendation": "string",
      "evidence": "string — 若有銷量異常請引用具體日期和 delta%"
    }
  ]
}`,
    retire_candidates: `${base}

重要：毛利矩陣中的 qty_trend_pct 是本期銷量與前一同長度期間的比較（已預先計算），請直接使用此數值作為 candidates 中的 qty_trend_pct，不要自行推算。

輸出格式：
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "summary": "string",
  "candidates": [
    {
      "product_name": "string",
      "category": "string",
      "gross_margin": number (0-1),
      "qty_trend_pct": number (直接使用毛利矩陣中的 qty_trend_pct 值),
      "basket_risk": "會被影響的商品",
      "anomaly_flag": "spike | drop | none — 該商品近期是否出現銷量異常",
      "verdict": "retire | caution | monitor",
      "reason": "string",
      "evidence": "string — 若有銷量異常請引用具體日期和 delta%"
    }
  ]
}`,
    labor_cost: `${base}

你正在分析一家餐飲店的人力成本狀況。資料為每月實際發放薪資（ground truth）。
目標成本率為 30%；低於 30% 健康，高於 40% 嚴重。
餐飲業兼職薪資占比 30-40% 通常為健康結構。

輸出格式：
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "summary": "2-3 句執行摘要",
  "headline_metrics": {
    "avg_cost_ratio": number (0-1),
    "target_ratio": 0.30,
    "revenue_per_salary": number,
    "trend": "improving | stable | worsening",
    "months_analyzed": ["YYYY-MM"]
  },
  "department_insights": [
    {
      "department": "string",
      "payroll_share_pct": number (0-100),
      "concern": "over-indexed | under-indexed | balanced",
      "observation": "string — 為什麼這部門成本偏高/偏低，給出具體推論"
    }
  ],
  "overtime_analysis": {
    "total_ot_hours": number,
    "ot_ratio_pct": number (0-100),
    "ot_premium_estimate": number (台幣),
    "top_concerns": [
      {
        "name": "string",
        "ot_hours": number,
        "implication": "string — 例如：OT 規律性高，可能是排班不足"
      }
    ],
    "assessment": "string — OT 整體健康度評估"
  },
  "employment_mix": {
    "ft_share_pct": number (0-100),
    "pt_share_pct": number (0-100),
    "assessment": "healthy | too-rigid | too-fluid",
    "observation": "string"
  },
  "anomalies": [
    {
      "category": "ratio | department | overtime | individual_pay",
      "severity": "high | medium | low",
      "description": "string",
      "evidence": "具體數字"
    }
  ],
  "recommendations": [
    {
      "priority": "high | medium | low",
      "action": "string — 具體可執行動作",
      "expected_impact": "string — 預期效益"
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

  // Margin matrix (with trend vs previous period)
  if (marginMatrix.length > 0) {
    sections.push('\n## 毛利矩陣（含銷量趨勢：本期 vs 前一同長度期間）')
    sections.push('product_name | category | total_qty | total_revenue | gross_margin | qty_trend_pct')
    for (const row of marginMatrix.slice(0, 40)) {
      sections.push(
        `${row.product_name} | ${row.category ?? '-'} | ${row.total_quantity} | ${row.total_revenue} | ${(row.gross_margin * 100).toFixed(1)}% | ${row.qty_trend_pct > 0 ? '+' : ''}${row.qty_trend_pct}%`
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

  // Review snapshots
  if (ctx.reviewSnapshots.length > 0) {
    sections.push('\n## 評論數據')
    sections.push('week | avg_rating | new_reviews | negative_count | negative_summary')
    for (const r of ctx.reviewSnapshots) {
      sections.push(
        `${r.snapshot_date} | ${r.avg_rating ?? '-'} | ${r.new_reviews_count ?? '-'} | ${r.negative_count ?? '-'} | ${r.ai_negative_summary ?? '-'}`
      )
    }
    // Include sentiment trend and keywords from latest snapshot
    const latest = ctx.reviewSnapshots[ctx.reviewSnapshots.length - 1]
    if (latest.ai_sentiment_trend) {
      sections.push(`\n評價趨勢：${latest.ai_sentiment_trend}`)
    }
    if (latest.keywords && latest.keywords.length > 0) {
      sections.push(`負評關鍵字：${latest.keywords.join('、')}`)
    }
  }

  // Product anomalies
  if (ctx.productAnomalies.length > 0) {
    sections.push('\n## 商品銷量異常 (14日均線基準，spike >200%, drop <30%)')
    sections.push('date | product_name | category | type | actual_qty | baseline_qty | delta_pct | weather | campaign | kol')
    for (const a of ctx.productAnomalies.slice(0, 40)) {
      sections.push(
        `${a.anomaly_date} | ${a.product_name} | ${a.category ?? '-'} | ${a.anomaly_type} | ${a.actual_qty} | ${a.baseline_qty} | ${a.delta_pct > 0 ? '+' : ''}${a.delta_pct}% | ${a.weather_type}${a.is_typhoon_day ? '(颱風)' : ''} | ${a.campaign_name ?? '-'} | ${a.kol_name ?? '-'}`
      )
    }
    // Summary
    const spikes = ctx.productAnomalies.filter(a => a.anomaly_type === 'spike').length
    const drops = ctx.productAnomalies.filter(a => a.anomaly_type === 'drop').length
    sections.push(`\n異常摘要：共 ${ctx.productAnomalies.length} 筆（暴增 ${spikes}、驟降 ${drops}）`)
  }

  if (reportType === 'expansion') {
    sections.push('\n請根據以上數據評估展店準備度，重點關注：')
    sections.push('1. 哪些時段表現最佳（從每日營收和商品銷售推斷）')
    sections.push('2. 哪些商品類別是核心營收來源')
    sections.push('3. 會員結構是否健康（回訪率、新客佔比）')
    sections.push('4. 營收穩定性和季節性趨勢')
    sections.push('5. 新店應該採取什麼型態（外帶、內用、複合）')
    sections.push('6. 品牌聲譽是否適合展店（Google 評分趨勢、負評主題是否為系統性問題）')
    sections.push('7. 天氣對業績的影響模式：颱風日平均業績下降幅度、雨天對外送/外帶比例的影響')
    sections.push('   — 新店選址應考慮當地天氣模式（年均雨天比例、颱風季影響）')
  }

  sections.push('\n請根據以上數據產生分析報告 JSON。')

  return sections.join('\n')
}

function buildLaborPrompt(ctx: LaborContext): string {
  const sections: string[] = []
  sections.push(`# 分析請求：人力成本分析`)
  sections.push(`分析期間：${ctx.periodStart} ~ ${ctx.periodEnd}`)
  sections.push(`目標成本率：${(ctx.targetCostRatio * 100).toFixed(0)}%`)

  if (ctx.monthsMissing.length > 0) {
    sections.push(`\n⚠️ 下列月份薪資未上傳，不計入分析：${ctx.monthsMissing.join(', ')}`)
  }

  sections.push('\n## 每月薪資與營收')
  sections.push('month | payroll | revenue | cost_ratio | revenue_per_salary | staff | ft_count | pt_count | ot_hours | ot_ratio | ot_premium_est')
  for (const m of ctx.perMonth) {
    sections.push(
      `${m.label} | ${m.total_payable} | ${m.total_revenue} | ${m.cost_ratio != null ? (m.cost_ratio * 100).toFixed(1) + '%' : '-'} | ${m.revenue_per_salary ?? '-'} | ${m.staff_count} | ${m.ft_count} | ${m.pt_count} | ${m.total_overtime_hours}h | ${m.ot_hours_ratio != null ? (m.ot_hours_ratio * 100).toFixed(1) + '%' : '-'} | ${m.estimated_ot_premium}`
    )
  }

  sections.push('\n## 每月部門薪資拆解')
  for (const m of ctx.perMonth) {
    const parts = m.departments.map(d => `${d.name} ${d.total} (${d.share_pct}%)`).join(' | ')
    sections.push(`${m.label}: ${parts}`)
  }

  sections.push('\n## 每月正職 vs 兼職薪資')
  sections.push('month | ft_payable | pt_payable | ft_share% | pt_share%')
  for (const m of ctx.perMonth) {
    const total = m.ft_payable + m.pt_payable
    const ftShare = total > 0 ? ((m.ft_payable / total) * 100).toFixed(1) : '-'
    const ptShare = total > 0 ? ((m.pt_payable / total) * 100).toFixed(1) : '-'
    sections.push(`${m.label} | ${m.ft_payable} | ${m.pt_payable} | ${ftShare}% | ${ptShare}%`)
  }

  if (ctx.topOvertimeStaff.length > 0) {
    sections.push('\n## 加班最多員工 Top 5（區間彙總）')
    sections.push('name | dept | total_hours | ot_hours | implied_hourly')
    for (const s of ctx.topOvertimeStaff) {
      sections.push(`${s.name} | ${s.department ?? '-'} | ${s.total_hours}h | ${s.total_overtime_hours}h | ${s.implied_hourly ?? '-'}`)
    }
  }

  // Staff table — focus on outliers (highest implied hourly, lowest implied hourly)
  const sortedByHourly = [...ctx.staffAnalysis]
    .filter(s => s.implied_hourly != null)
    .sort((a, b) => (b.implied_hourly || 0) - (a.implied_hourly || 0))
  const topHourly = sortedByHourly.slice(0, 10)
  const bottomHourly = sortedByHourly.slice(-5)
  if (topHourly.length > 0) {
    sections.push('\n## 實質時薪最高 Top 10（可能為高階或大量加班）')
    sections.push('name | type | dept | hours | implied_hourly | total_pay')
    for (const s of topHourly) {
      sections.push(`${s.name} | ${s.employment_type === 'part_time' ? 'PT' : 'FT'} | ${s.department ?? '-'} | ${s.total_hours}h | ${s.implied_hourly} | ${s.total_payable}`)
    }
  }
  if (bottomHourly.length > 0) {
    sections.push('\n## 實質時薪最低 Bottom 5')
    sections.push('name | type | dept | hours | implied_hourly | total_pay')
    for (const s of bottomHourly) {
      sections.push(`${s.name} | ${s.employment_type === 'part_time' ? 'PT' : 'FT'} | ${s.department ?? '-'} | ${s.total_hours}h | ${s.implied_hourly} | ${s.total_payable}`)
    }
  }

  sections.push(`\n共 ${ctx.staffAnalysis.length} 位員工在這段期間有薪資紀錄。`)

  sections.push('\n請根據以上資料產生人力成本分析 JSON。特別注意：')
  sections.push('1. 成本率趨勢（是否穩定在目標內、月與月的差異由什麼造成）')
  sections.push('2. 部門成本是否過度集中某一個部門，該部門的貢獻是否匹配其成本')
  sections.push('3. 加班是否顯著（個人 vs 整體），哪些人有「經常性加班」訊號')
  sections.push('4. FT/PT 比例是否健康；有沒有過度僵化或過度依賴兼職的風險')
  sections.push('5. 是否有實質時薪明顯異常的員工（可能需要審查計薪或排班）')
  sections.push('6. 給 2-4 條具體、可執行的建議')

  return sections.join('\n')
}
