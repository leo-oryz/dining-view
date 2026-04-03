import * as XLSX from 'xlsx'
import type { ParseError } from './eat365Summary'

export interface ProductSalesRow {
  product_name: string
  category: string | null
  product_type: string | null
  sub_product_type: string | null
  product_code: string | null
  price: number | null
  quantity_sold: number | null
  discount_amount: number | null
  revenue: number | null
  total_cost: number | null
  gross_profit: number | null
  gross_margin: number | null
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

function parseMargin(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/%/g, '').replace(/,/g, '')
  const num = Number(str)
  if (isNaN(num)) return null
  // If it looks like a percentage (> 1), divide by 100
  return num > 1 ? num / 100 : num
}

export function parseEat365Items(buffer: ArrayBuffer): { data: ProductSalesRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: ProductSalesRow[] = []

  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    // Header at row 1, data from row 2
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0]) continue

      const productName = String(row[0]).trim()
      if (!productName) {
        errors.push({ row: i + 1, field: 'SKU Name', message: 'Empty product name' })
        continue
      }

      // Skip header rows and total rows that appear in the data range
      const skipNames = ['SKU Name', 'Category', 'Total', 'Grand Total']
      if (skipNames.includes(productName)) continue

      data.push({
        product_name: productName,
        category: row[1] ? String(row[1]).trim() : null,
        product_type: row[2] ? String(row[2]).trim() : null,
        sub_product_type: row[3] ? String(row[3]).trim() : null,
        product_code: row[4] ? String(row[4]).trim() : null,
        price: parseNum(row[5]),
        quantity_sold: parseNum(row[6]),
        discount_amount: parseNum(row[7]),
        revenue: parseNum(row[8]),
        total_cost: parseNum(row[9]),
        gross_profit: parseNum(row[10]),
        gross_margin: parseMargin(row[11]),
      })
    }
  } catch (e) {
    errors.push({ row: 0, field: '', message: `Failed to parse xls: ${(e as Error).message}` })
  }

  return { data, errors }
}
