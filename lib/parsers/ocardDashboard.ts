import * as XLSX from 'xlsx'
import type { ParseError } from './eat365Summary'

export interface OcardDailyRow {
  date: string
  member_visits: number | null
  new_members: number | null
  regular_members: number | null
  total_members: number | null
  invited_members: number | null
  new_reachable_members: number | null
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

export function parseOcardDashboard(buffer: ArrayBuffer): { data: OcardDailyRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: OcardDailyRow[] = []

  try {
    const workbook = XLSX.read(buffer, { type: 'array' })

    // Use "明細" sheet
    const sheetName = workbook.SheetNames.find(n => n.includes('明細')) || workbook.SheetNames[1]
    if (!sheetName) {
      errors.push({ row: 0, field: '', message: 'Cannot find "明細" sheet in workbook' })
      return { data, errors }
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    // Header at row 2 (index 1), data from row 3 (index 2)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0]) continue

      const dateVal = row[0]
      let dateStr: string

      if (typeof dateVal === 'number') {
        const parsed = XLSX.SSF.parse_date_code(dateVal)
        dateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      } else {
        // Format could be "2026-3-26" or "2026/3/26"
        const parts = String(dateVal).split(/[-/]/)
        if (parts.length === 3) {
          dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
        } else {
          errors.push({ row: i + 1, field: '日期', message: `Invalid date: ${dateVal}` })
          continue
        }
      }

      data.push({
        date: dateStr,
        member_visits: parseNum(row[1]),   // 來客人次
        new_members: parseNum(row[2]),      // 新客人次
        regular_members: parseNum(row[3]),  // 熟客人次
        total_members: parseNum(row[4]),    // 總會員數
        invited_members: parseNum(row[5]),  // 邀請會員數
        new_reachable_members: parseNum(row[7]),  // 新可觸及會員數
      })
    }
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse xlsx: ${(e as Error).message}` })
  }

  return { data, errors }
}
