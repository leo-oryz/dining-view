// Parses items_report.xlsx — wide format, one row per SKU and 8 columns per date.
// Header structure (skip first 3 rows; data starts row 4):
//   Col 1: Mã món       (SKU id, e.g. ITEM-06WB)
//   Col 2: Tên món      (item name)
//   Col 3: Đơn vị       (unit)
//   Col 4: Nhóm món     (category)
//   Col 5: Loại món     (item type)
//   Cols 6–13: Tổng     (8 cols: Đã bán, Hoa hồng, Giảm giá M, Giảm giá P, Thuế, Doanh thu net, Doanh thu gross, Giá TB)
//   Cols 14+: per-date blocks of 8 cols each, with the date label DD/MM/YYYY in one of the upper header rows.
//
// We pivot to long format: one ProductSalesRow per (SKU × date) where Đã bán > 0.

import * as XLSX from 'xlsx'
import type { ParseResult, ProductSalesRow } from './types'
import { computeDateRange, parseVietnameseDate, toInt } from './utils'

// Each date block has 8 columns: Đã bán, Hoa hồng, GG-M, GG-P, Thuế, Net, Gross, Giá TB.
// Layout: 5 fixed cols (Mã món..Loại món) + 8 cols of leading "Tổng" block, then per-date blocks.
const FIRST_DATE_COL = 13 // 0-indexed start of the first per-date block

interface DateBlock {
  date: string // YYYY-MM-DD
  startCol: number
}

function detectDateBlocks(grid: unknown[][]): DateBlock[] {
  // Date labels appear somewhere in the first 3 header rows. We scan all of
  // them and take the first DD/MM/YYYY label found at or after FIRST_DATE_COL,
  // assigning it to the column where the label sits. iPOS labels each date
  // block at the start of its 8-column group.
  const blocks: DateBlock[] = []
  const seen = new Set<number>()

  for (let row = 0; row < Math.min(3, grid.length); row++) {
    const r = grid[row]
    if (!r) continue
    for (let col = FIRST_DATE_COL; col < r.length; col++) {
      const cell = r[col]
      if (typeof cell !== 'string') continue
      const iso = parseVietnameseDate(cell)
      if (!iso) continue
      if (seen.has(col)) continue
      blocks.push({ date: iso, startCol: col })
      seen.add(col)
    }
  }

  // Sort by column to pair up correctly.
  blocks.sort((a, b) => a.startCol - b.startCol)
  return blocks
}

export function parseItemsReport(buffer: ArrayBuffer): ParseResult<ProductSalesRow> {
  const errors: string[] = []
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { rows: [], dateRange: { start: '', end: '' }, errors: ['items_report: no sheets found'] }
  }
  const sheet = wb.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][]

  const dateBlocks = detectDateBlocks(grid)
  if (dateBlocks.length === 0) {
    errors.push('items_report: no date columns detected in header rows')
    return { rows: [], dateRange: { start: '', end: '' }, errors }
  }

  const rows: ProductSalesRow[] = []
  // Data rows start at index 3 (skip first 3 header rows).
  for (let i = 3; i < grid.length; i++) {
    const r = grid[i]
    if (!r || r.length === 0) continue
    const skuId = r[0]
    if (typeof skuId !== 'string' || !skuId.trim()) continue // skip category header rows (e.g. "SET MENU")

    const skuName = (r[1] as string) || ''
    const unit    = (r[2] as string) || ''
    const category= (r[3] as string) || ''
    const itemType= (r[4] as string) || ''

    for (const block of dateBlocks) {
      const c = block.startCol
      const qty   = toInt(r[c + 0]) // Đã bán
      if (qty === 0) continue

      const discountMerchant = toInt(r[c + 2])
      const discountPartner  = toInt(r[c + 3])
      const netRevenue       = toInt(r[c + 5]) // Doanh thu (net)
      const grossRevenue     = toInt(r[c + 6]) // Doanh thu (gross)
      const avgPriceRaw      = toInt(r[c + 7]) // Giá trung bình

      rows.push({
        date: block.date,
        sku_id: skuId.trim(),
        sku_name: skuName.trim(),
        unit: unit.trim(),
        category: category.trim(),
        item_type: itemType.trim(),
        quantity_sold: qty,
        net_revenue: netRevenue,
        gross_revenue: grossRevenue,
        discount_amount: discountMerchant + discountPartner,
        avg_price: avgPriceRaw > 0 ? avgPriceRaw : null,
      })
    }
  }

  if (rows.length === 0) errors.push('items_report: no product rows found')

  return {
    rows,
    dateRange: computeDateRange(dateBlocks.map(b => b.date)),
    errors,
  }
}
