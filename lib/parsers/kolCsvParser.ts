import Papa from 'papaparse'

export interface KolCsvRow {
  no: number | null
  contract_number: string | null
  kol_name: string
  real_name: string | null
  platform: string | null        // Instagram, Blogger, IG, etc.
  link_label: string | null      // "IG", "LINK", etc.
  collaboration_date: string     // YYYY-MM-DD
  visit_time: string | null      // HH:MM
  party_size: string | null
  contact_info: string | null
  confirmation_status: string | null
  contract_sent: string | null
  visit_status: string | null
  content_status: string | null
  invoice_status_1: string | null
  invoice_status_2: string | null
  payment_status: string | null
  content_type: string | null    // Reels, Blog
  collaboration_fee: number | null
  content_url: string | null
  views: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  engagement_rate: number | null
}

export interface ParseError {
  row: number
  field: string
  message: string
}

/**
 * Normalize platform names from CSV to our standard format
 */
function normalizePlatform(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  if (lower === 'instagram' || lower === 'ig') return 'instagram'
  if (lower === 'blogger' || lower === 'blog') return 'blogger'
  if (lower === 'facebook' || lower === 'fb') return 'facebook'
  if (lower === 'tiktok') return 'tiktok'
  if (lower === 'youtube' || lower === 'yt') return 'youtube'
  if (lower === 'threads') return 'threads'
  return raw.trim()
}

/**
 * Parse date strings like "2025/12/20" or "2026/03/21" → "YYYY-MM-DD"
 */
function parseDate(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Handle YYYY/MM/DD or YYYY/M/D
  const match = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (match) {
    const [, y, m, d] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

/**
 * Parse currency strings like "$7,600" or "7600" → number
 */
function parseCurrency(raw: string | null): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

/**
 * Parse numeric strings, handling commas
 */
function parseNum(raw: string | null): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

/**
 * Parse percentage string like "11.14%" → 11.14
 */
function parsePercent(raw: string | null): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed === '#DIV/0!' || trimmed === '' || trimmed === '0.00%') return null
  const cleaned = trimmed.replace('%', '')
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

/**
 * Parse the KOL collaboration CSV file.
 * Header is on row 2 (index 1), row 1 (index 0) is empty.
 */
export function parseKolCsv(csvText: string): { data: KolCsvRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: KolCsvRow[] = []

  const result = Papa.parse(csvText, {
    skipEmptyLines: true,
  })

  const rows = result.data as string[][]

  // Find header row — look for row containing "名字" or "No."
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i]
    if (row.some(cell => cell.trim() === '名字' || cell.trim() === 'No.')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    errors.push({ row: 0, field: 'header', message: '找不到表頭列（需包含「名字」欄位）' })
    return { data, errors }
  }

  const headers = rows[headerIdx].map(h => h.trim())

  // Map header names to column indices
  const col = (name: string): number => headers.indexOf(name)

  const iNo = col('No.')
  const iContract = col('合約編號')
  const iName = col('名字')
  const iRealName = col('真實姓名')
  const iPlatform = col('社交媒體')
  const iLink = col('連結')
  // 探店時間 spans two columns: date + time
  const iDate = col('探店時間')
  const iTime = iDate >= 0 ? iDate + 1 : -1  // time is the next column
  const iPartySize = col('人數')
  const iContact = col('聯繫資訊')
  const iConfirm = col('確認')
  const iContractSent = col('合約寄出')
  const iVisit = col('到店狀況')
  const iContent = col('素材狀況')
  const iInvoice1 = col('請款流程01')
  const iInvoice2 = col('請款流程02')
  const iPayment = col('付款狀態')
  const iContentType = col('素材類別')
  const iFee = col('已付金額（台幣）')
  const iContentUrl = col('素材連結')
  const iViews = col('觀看率')
  const iReach = col('觸及的帳號數量')
  const iLikes = col('按讚')
  const iComments = col('留言')
  const iShares = col('分享')
  const iSaves = col('儲存')
  const iEngRate = col('互動率')

  if (iName < 0) {
    errors.push({ row: headerIdx, field: '名字', message: '表頭缺少「名字」欄位' })
    return { data, errors }
  }

  // Parse data rows
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    const kolName = row[iName]?.trim()
    if (!kolName) continue // skip empty rows

    const dateStr = iDate >= 0 ? parseDate(row[iDate]) : null
    if (!dateStr) {
      errors.push({ row: rowNum, field: '探店時間', message: `日期格式無效: "${row[iDate]}"` })
      continue
    }

    const timeStr = iTime >= 0 && row[iTime] ? row[iTime].trim() : null

    data.push({
      no: iNo >= 0 ? parseNum(row[iNo]) : null,
      contract_number: iContract >= 0 ? (row[iContract]?.trim() || null) : null,
      kol_name: kolName,
      real_name: iRealName >= 0 ? (row[iRealName]?.trim() || null) : null,
      platform: normalizePlatform(iPlatform >= 0 ? row[iPlatform] : null),
      link_label: iLink >= 0 ? (row[iLink]?.trim() || null) : null,
      collaboration_date: dateStr,
      visit_time: timeStr,
      party_size: iPartySize >= 0 ? (row[iPartySize]?.trim() || null) : null,
      contact_info: iContact >= 0 ? (row[iContact]?.trim() || null) : null,
      confirmation_status: iConfirm >= 0 ? (row[iConfirm]?.trim() || null) : null,
      contract_sent: iContractSent >= 0 ? (row[iContractSent]?.trim() || null) : null,
      visit_status: iVisit >= 0 ? (row[iVisit]?.trim() || null) : null,
      content_status: iContent >= 0 ? (row[iContent]?.trim() || null) : null,
      invoice_status_1: iInvoice1 >= 0 ? (row[iInvoice1]?.trim() || null) : null,
      invoice_status_2: iInvoice2 >= 0 ? (row[iInvoice2]?.trim() || null) : null,
      payment_status: iPayment >= 0 ? (row[iPayment]?.trim() || null) : null,
      content_type: iContentType >= 0 ? (row[iContentType]?.trim() || null) : null,
      collaboration_fee: iFee >= 0 ? parseCurrency(row[iFee]) : null,
      content_url: iContentUrl >= 0 ? (row[iContentUrl]?.trim() || null) : null,
      views: iViews >= 0 ? parseNum(row[iViews]) : null,
      reach: iReach >= 0 ? parseNum(row[iReach]) : null,
      likes: iLikes >= 0 ? parseNum(row[iLikes]) : null,
      comments: iComments >= 0 ? parseNum(row[iComments]) : null,
      shares: iShares >= 0 ? parseNum(row[iShares]) : null,
      saves: iSaves >= 0 ? parseNum(row[iSaves]) : null,
      engagement_rate: iEngRate >= 0 ? parsePercent(row[iEngRate]) : null,
    })
  }

  return { data, errors }
}
