import Papa from 'papaparse'
import type { ParseError } from './eat365Summary'

export interface OcardMemberOrderRow {
  member_name: string | null
  member_phone: string | null
  item_name: string | null
  product_code: string | null
  member_tier: string | null
  gender: string | null
  age: string | null
  quantity: number | null
  unit_price: number | null
  time: string | null
  date: string
  order_number: string | null
  store_name: string | null
  category: string | null
  subtotal: number | null
  order_total: number | null
  member_card_id: string | null
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

function stripExcelQuote(val: string | null | undefined): string | null {
  if (!val) return null
  // Strip ="..." wrapping
  const match = String(val).match(/^="?(.*?)"?$/)
  return match ? match[1] : String(val).trim()
}

export function parseOcardMembers(csvText: string): { data: OcardMemberOrderRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: OcardMemberOrderRow[] = []

  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  if (result.errors.length > 0) {
    result.errors.forEach((e, idx) => {
      errors.push({ row: e.row ?? idx, field: '', message: e.message })
    })
  }

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as Record<string, string>

    const timeStr = row['交易時間']?.trim() || null
    let dateStr = ''
    if (timeStr) {
      try {
        const d = new Date(timeStr)
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().split('T')[0]
        }
      } catch {
        // fallback
      }
    }

    // Column names based on sample: 名稱, 手機號碼, 名稱.1, 商品編號, 會員等級, 性別, 年齡, 數量, 單價, 交易時間, 交易序號, 店家, 其他, 小計, 交易總計, 會員卡號
    const columns = Object.keys(row)
    const nameCol = columns[0] // 名稱 (customer name)
    const phoneCol = columns[1] // 手機號碼
    const productCol = columns[2] // 名稱.1 (product name)

    data.push({
      member_name: row[nameCol]?.trim() || null,
      member_phone: stripExcelQuote(row[phoneCol]),
      item_name: row[productCol]?.trim() || null,
      product_code: row['商品編號']?.trim() || null,
      member_tier: row['會員等級']?.trim() || null,
      gender: row['性別']?.trim() || null,
      age: row['年齡']?.trim() || null,
      quantity: parseNum(row['數量']),
      unit_price: parseNum(row['單價']),
      time: timeStr,
      date: dateStr,
      order_number: row['交易序號']?.trim() || null,
      store_name: row['店家']?.trim() || null,
      category: row['其他']?.trim() || null,
      subtotal: parseNum(row['小計']),
      order_total: parseNum(row['交易總計']),
      member_card_id: stripExcelQuote(row['會員卡號']),
    })
  }

  return { data, errors }
}
