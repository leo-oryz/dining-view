// iPOS export parser types — shared across daily/hourly/payment/product/source parsers.

export interface DailySalesRow {
  date: string // YYYY-MM-DD (Asia/Ho_Chi_Minh wall date)
  net_revenue: number
  gross_revenue?: number
  discount_amount?: number
  invoice_count: number
  cover_count: number
}

export interface HourlySalesRow {
  date: string // YYYY-MM-DD — when the upload spans multiple days, hourly is aggregated; we tag every row with the dateRange.start.
  hour: number // 0–23
  net_revenue: number
  invoice_count: number
  cover_count: number
}

export interface PaymentRow {
  date: string // YYYY-MM-DD
  visa_amount: number
  visa_count: number
  transfer_amount: number
  transfer_count: number
  deposit_amount: number
  deposit_count: number
  cash_amount: number
  cash_count: number
}

export interface ProductSalesRow {
  date: string // YYYY-MM-DD
  sku_id: string
  sku_name: string
  unit: string
  category: string
  item_type: string
  quantity_sold: number
  net_revenue: number
  gross_revenue: number
  discount_amount: number
  avg_price: number | null
}

export interface SourceRow {
  date: string // YYYY-MM-DD
  invoice_count: number
  cover_count: number
  discount_amount: number
  net_revenue: number
  gross_revenue: number
}

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}

export interface ParseResult<T> {
  rows: T[]
  dateRange: DateRange
  errors: string[]
  warnings?: string[]
}
