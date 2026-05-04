export const APP_CURRENCY = 'VND'
export const APP_LOCALE = 'vi-VN'

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return '0 ₫'
  const rounded = Math.round(Number(value))
  return `${rounded.toLocaleString('vi-VN').replace(/,/g, '.')} ₫`
}
