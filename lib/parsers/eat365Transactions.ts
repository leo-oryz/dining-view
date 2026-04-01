import Papa from 'papaparse'
import type { ParseError } from './eat365Summary'

export interface OrderItemRow {
  order_number: string
  order_type: string | null
  time: string | null
  tender: string | null
  guest_count: number | null
  subtotal: number | null
  discount: number | null
  order_total: number | null
  item_name: string | null
  item_type: string | null
  product_type: string | null
  item_amount: number | null
  item_quantity: number | null
  cost: number | null
  modifier_name: string | null
  modifier_value: string | null
  date: string
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).replace(/,/g, '')
  const num = Number(str)
  return isNaN(num) ? null : num
}

export function parseEat365Transactions(csvText: string): { data: OrderItemRow[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const data: OrderItemRow[] = []

  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  if (result.errors.length > 0) {
    result.errors.forEach((e, idx) => {
      errors.push({ row: e.row ?? idx, field: '', message: e.message })
    })
  }

  let currentOrder: { order_number: string; order_type: string | null; time: string | null; tender: string | null; guest_count: number | null; subtotal: number | null; discount: number | null; order_total: number | null; date: string } | null = null

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as Record<string, string>
    const orderNum = row['Order Number']?.trim()
    if (!orderNum) continue

    const timeStr = row['Time']?.trim() || null
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

    // Update current order context
    if (row['Order Type']?.trim()) {
      currentOrder = {
        order_number: orderNum,
        order_type: row['Order Type']?.trim() || null,
        time: timeStr,
        tender: row['Tender']?.trim() || null,
        guest_count: parseNum(row['No. of guest']),
        subtotal: parseNum(row['Sub-total(TWD)']),
        discount: parseNum(row['Discount(TWD)']),
        order_total: parseNum(row['Order Total(TWD)']),
        date: dateStr,
      }
    }

    const itemName = row['Item Name']?.trim()
    const itemType = row['Item Type']?.trim()

    // Skip rows with no item name
    if (!itemName) continue

    data.push({
      order_number: orderNum,
      order_type: currentOrder?.order_type ?? null,
      time: currentOrder?.time ?? timeStr,
      tender: currentOrder?.tender ?? null,
      guest_count: currentOrder?.guest_count ?? null,
      subtotal: currentOrder?.subtotal ?? null,
      discount: currentOrder?.discount ?? null,
      order_total: currentOrder?.order_total ?? null,
      item_name: itemName,
      item_type: itemType || null,
      product_type: row['Product Type']?.trim() || null,
      item_amount: parseNum(row['Item Amount(TWD)']),
      item_quantity: parseNum(row['Item Quantity']),
      cost: parseNum(row['Cost']),
      modifier_name: row['Modifier Name']?.trim() || null,
      modifier_value: row['Modifier Value']?.trim() || null,
      date: currentOrder?.date ?? dateStr,
    })
  }

  return { data, errors }
}
